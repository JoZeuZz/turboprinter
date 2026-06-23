from __future__ import annotations

import os

from fastapi import Request

from app.application.services.media_aggregator import MediaAggregator
from app.application.services.shot_planner import ShotPlanner
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
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.models.exception import HttpException
from app.models.project_schema import (
    BaseProjectResponse,
    CreateFromScriptRequest,
    CreateFromTopicRequest,
    MediaSearchRequest,
    PlanRequest,
)
from app.services import llm
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
