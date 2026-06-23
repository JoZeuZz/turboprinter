from __future__ import annotations

import glob
import os

from fastapi import BackgroundTasks, Request

from app.application.services.media_aggregator import MediaAggregator
from app.application.services.shot_planner import ShotPlanner
from app.application.services.timeline_builder import TimelineBuilder
from app.application.workflows import render_project as rp
from app.config import config
from app.controllers import base
from app.controllers.v1.base import new_router
from app.infrastructure.llm.structured_output import LiteLLMStructuredProvider
from app.infrastructure.media_providers.local_provider import LocalLibraryProvider
from app.infrastructure.media_providers.stock_providers import (
    CoverrProvider,
    PexelsProvider,
    PixabayProvider,
)
from app.domain.projects.models import TimelineProject
from app.domain.rendering.models import RenderSpec
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.models import const
from app.models.exception import HttpException
from app.models.project_schema import (
    BaseProjectResponse,
    CreateFromScriptRequest,
    CreateFromTopicRequest,
    MediaSearchRequest,
    PlanRequest,
    RenderRequest,
    TimelineBuildRequest,
    TimelineCommandsRequest,
)
from app.services import llm
from app.services import state as sm
from app.utils import utils

router = new_router()


def _store() -> FilesystemProjectStore:
    return FilesystemProjectStore()


def _require_project_mode(request: Request) -> str:
    if not getattr(config, "project_mode_enabled", False):
        raise HttpException(
            task_id="", status_code=404, message="project mode disabled"
        )
    return base.get_task_id(request)


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


def _shot_planner(store):
    return ShotPlanner(LiteLLMStructuredProvider(), store=store)


def _media_aggregator(store):
    providers = [PexelsProvider(), PixabayProvider(), CoverrProvider(), LocalLibraryProvider()]
    return MediaAggregator([p for p in providers if p.is_configured()], store=store)


def _timeline_builder(store):
    return TimelineBuilder(store=store)


@router.post("/projects/from-topic", response_model=BaseProjectResponse,
             summary="Create a project from a topic")
def create_from_topic(request: Request, body: CreateFromTopicRequest):
    _require_project_mode(request)
    task_id = utils.get_uuid()
    store = _store()
    script = ""
    if body.generate_script:
        script = llm.generate_script(
            video_subject=body.topic, language=body.language,
            paragraph_number=body.paragraph_number,
        )
    store.save_script(task_id, script)
    return _ok({"project_id": task_id, "has_script": bool(script)})


@router.post("/projects/from-script", response_model=BaseProjectResponse,
             summary="Create a project from a pasted script")
def create_from_script(request: Request, body: CreateFromScriptRequest):
    _require_project_mode(request)
    if not body.script.strip():
        raise HttpException(task_id="", status_code=400, message="script is empty")
    task_id = utils.get_uuid()
    _store().save_script(task_id, body.script)
    return _ok({"project_id": task_id, "has_script": True})


@router.get("/projects/{project_id}", response_model=BaseProjectResponse,
            summary="Get project state")
def get_project(request: Request, project_id: str):
    _require_project_mode(request)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    return _ok({
        "project_id": project_id,
        "has_script": store.load_script(project_id) is not None,
        "has_shot_plan": store.load_shot_plan(project_id) is not None,
        "has_selected_media": bool(store.load_selected_media(project_id)),
        "has_timeline": store.load_timeline(project_id) is not None,
    })


@router.post("/projects/{project_id}/plan", response_model=BaseProjectResponse,
             summary="Run the shot planner")
def plan_project(request: Request, project_id: str, body: PlanRequest):
    _require_project_mode(request)
    store = _store()
    script = store.load_script(project_id) or ""
    if not script.strip():
        raise HttpException(task_id=project_id, status_code=400, message="project has no script")
    plan = _shot_planner(store).plan(
        script=script, language="es",
        target_duration_sec=body.target_duration_sec,
        visual_style=body.global_visual_style, task_id=project_id,
    )
    return _ok({"project_id": project_id, "segment_count": len(plan.segments)})


@router.post("/projects/{project_id}/media/search", response_model=BaseProjectResponse,
             summary="Search and select media for the shot plan")
def media_search(request: Request, project_id: str, body: MediaSearchRequest):
    _require_project_mode(request)
    store = _store()
    plan = store.load_shot_plan(project_id)
    if plan is None:
        raise HttpException(task_id=project_id, status_code=400, message="run /plan first")
    selection = _media_aggregator(store).select_for_plan(
        plan, orientation=body.orientation, prefer_local=body.prefer_local, task_id=project_id,
    )
    return _ok({"project_id": project_id, "selected_count": len(selection)})


@router.post("/projects/{project_id}/timeline/build", response_model=BaseProjectResponse,
             summary="Build the timeline from plan + selected media")
def timeline_build(request: Request, project_id: str, body: TimelineBuildRequest):
    _require_project_mode(request)
    store = _store()
    if store.load_shot_plan(project_id) is None:
        raise HttpException(task_id=project_id, status_code=400, message="run /plan first")
    project = _timeline_builder(store).build_from_store(
        project_id, title=body.title,
        narration_audio_path=body.narration_audio_path, subtitle_path=body.subtitle_path,
    )
    return _ok({"project_id": project_id, "track_count": len(project.tracks)})


@router.post("/projects/{project_id}/timeline/commands", response_model=BaseProjectResponse,
             summary="Apply edit commands to the timeline")
def timeline_commands(request: Request, project_id: str, body: TimelineCommandsRequest):
    _require_project_mode(request)
    store = _store()
    project = store.load_timeline(project_id)
    if project is None:
        raise HttpException(task_id=project_id, status_code=400, message="no timeline")
    try:
        for command in body.commands:
            project.apply(command)
    except (KeyError, TypeError) as exc:
        raise HttpException(task_id=project_id, status_code=400, message=str(exc))
    store.save_timeline(project_id, project)
    return _ok({"project_id": project_id, "applied": len(body.commands)})


@router.put("/projects/{project_id}", response_model=BaseProjectResponse,
            summary="Replace the timeline project")
def replace_timeline(request: Request, project_id: str, project: TimelineProject):
    _require_project_mode(request)
    _store().save_timeline(project_id, project)
    return _ok({"project_id": project_id})


def _run_render(project_id: str, spec: RenderSpec) -> None:
    sm.state.update_task(project_id, state=const.TASK_STATE_PROCESSING, progress=10)
    try:
        store = _store()
        store.save_render_spec(project_id, spec)
        result = rp.render_project_from_store(project_id, store)
        if result.success:
            sm.state.update_task(
                project_id, state=const.TASK_STATE_COMPLETE, progress=100,
                output_path=result.output_path,
            )
        else:
            sm.state.update_task(
                project_id, state=const.TASK_STATE_FAILED, progress=100,
                error=result.error,
            )
    except Exception as exc:  # noqa: BLE001
        sm.state.update_task(
            project_id, state=const.TASK_STATE_FAILED, progress=100, error=str(exc)
        )


@router.post("/projects/{project_id}/render", response_model=BaseProjectResponse,
             status_code=202, summary="Render the project timeline (background)")
def render_project_endpoint(request: Request, project_id: str, body: RenderRequest,
                            background_tasks: BackgroundTasks):
    _require_project_mode(request)
    store = _store()
    project = store.load_timeline(project_id)
    if project is None:
        raise HttpException(task_id=project_id, status_code=400, message="build timeline first")
    spec = RenderSpec(
        project_id=project.project_id, task_id=project_id,
        renderer=body.renderer or getattr(config, "timeline_renderer", "moviepy"),
        width=project.export.width, height=project.export.height, fps=project.export.fps,
        codec=project.export.codec, audio_codec=project.export.audio_codec,
        include_subtitles=body.include_subtitles,
        include_background_music=body.include_background_music,
    )
    sm.state.update_task(project_id, state=const.TASK_STATE_PROCESSING, progress=0)
    background_tasks.add_task(_run_render, project_id, spec)
    return _ok({"project_id": project_id, "state": const.TASK_STATE_PROCESSING})


@router.get("/projects/{project_id}/render", response_model=BaseProjectResponse,
            summary="Get render status")
def render_status(request: Request, project_id: str):
    _require_project_mode(request)
    task = sm.state.get_task(project_id)
    if task is None:
        raise HttpException(task_id=project_id, status_code=404, message="no render started")
    return _ok(task)


@router.get("/projects/{project_id}/assets", response_model=BaseProjectResponse,
            summary="List project assets")
def list_assets(request: Request, project_id: str):
    _require_project_mode(request)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    task_dir = store.project_dir(project_id)
    assets = sorted(
        os.path.relpath(p, task_dir)
        for p in glob.glob(os.path.join(task_dir, "**", "*"), recursive=True)
        if os.path.isfile(p)
    )
    return _ok({"project_id": project_id, "assets": assets})
