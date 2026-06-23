from __future__ import annotations

import glob
import os

from fastapi import BackgroundTasks, Request
from fastapi.responses import FileResponse

from app.application.services.media_aggregator import MediaAggregator
from app.application.services.music_selector import MusicSelector
from app.application.services.shot_planner import ShotPlanner
from app.application.services.reddit_ingest import (
    RedditIngestService,
    RedditThreadNormalizer,
)
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
from app.domain.projects.validators import validate_timeline_project
from app.domain.planning.models import MusicIntent
from app.domain.rendering.models import RenderSpec
from app.infrastructure.music_providers.jamendo_provider import JamendoProvider
from app.infrastructure.music_providers.local_music_provider import LocalMusicProvider
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.models import const
from app.models.exception import HttpException
from app.models.project_schema import (
    BaseProjectResponse,
    CreateFromScriptRequest,
    CreateFromTopicRequest,
    CreateFromRedditRequest,
    MediaSearchRequest,
    MusicSelectRequest,
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


def _validate_project_id(project_id: str) -> None:
    normalized = project_id.replace("\\", "/")
    parts = normalized.split("/")
    if (
        not normalized
        or normalized.startswith("/")
        or any(part in ("", ".", "..") for part in parts)
    ):
        raise HttpException(task_id="", status_code=400, message="invalid project id")


def _require_project_mode(request: Request, project_id: str | None = None) -> str:
    if not getattr(config, "project_mode_enabled", False):
        raise HttpException(
            task_id="", status_code=404, message="project mode disabled"
        )
    if project_id is not None:
        _validate_project_id(project_id)
    return base.get_task_id(request)


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


def _dump_model(model):
    return model.model_dump(mode="json") if model is not None else None


def _dump_models(models):
    return [m.model_dump(mode="json") for m in models]


def _shot_planner(store):
    return ShotPlanner(LiteLLMStructuredProvider(), store=store)


def _media_aggregator(store):
    providers = [PexelsProvider(), PixabayProvider(), CoverrProvider(), LocalLibraryProvider()]
    return MediaAggregator([p for p in providers if p.is_configured()], store=store)


def _timeline_builder(store):
    return TimelineBuilder(store=store)


def _music_providers(local_only: bool = True):
    providers = [LocalMusicProvider(songs_dir=utils.resource_dir("songs"))]
    if not local_only:
        providers.append(JamendoProvider(api_key=os.getenv("JAMENDO_API_KEY", "")))
    return providers


def _music_intent(body: MusicSelectRequest, plan) -> MusicIntent | None:
    has_manual_intent = any([body.mood, body.energy, body.tempo, body.style, body.avoid])
    if has_manual_intent:
        if not body.mood or not body.energy:
            raise HttpException(
                task_id="", status_code=400,
                message="manual music intent requires mood and energy",
            )
        return MusicIntent(
            mood=body.mood,
            energy=body.energy,
            tempo=body.tempo,
            style=body.style,
            avoid=body.avoid,
            commercial_use_required=body.commercial_safe_only,
        )
    if plan is not None and plan.music_intent is not None:
        return plan.music_intent
    return None


def _inside_dir(path: str, base_dir: str) -> bool:
    try:
        return os.path.commonpath([base_dir, path]) == base_dir
    except ValueError:
        return False


def _safe_asset_id(asset_id: str) -> str:
    normalized = asset_id.replace("\\", "/").strip("/")
    parts = normalized.split("/")
    if not normalized or any(part in ("", ".", "..") for part in parts):
        raise HttpException(task_id="", status_code=400, message="invalid asset path")
    return normalized


def _project_asset_registry(store: FilesystemProjectStore, project_id: str) -> dict[str, str]:
    project_dir = os.path.realpath(store.project_dir(project_id))
    local_paths: list[str] = []
    timeline = store.load_timeline(project_id)
    if timeline is not None:
        for track in timeline.tracks:
            local_paths.extend(item.local_path for item in track.items if item.local_path)
    local_paths.extend(c.local_path for c in store.load_media_candidates(project_id) if c.local_path)
    local_paths.extend(c.local_path for c in store.load_selected_media(project_id) if c.local_path)
    local_paths.extend(m.local_path for m in store.load_selected_music(project_id) if m.local_path)

    assets: dict[str, str] = {}
    for local_path in local_paths:
        candidate = local_path
        if not os.path.isabs(candidate):
            candidate = os.path.join(project_dir, candidate)
        resolved = os.path.realpath(candidate)
        if not os.path.isfile(resolved) or not _inside_dir(resolved, project_dir):
            continue
        asset_id = os.path.relpath(resolved, project_dir).replace(os.sep, "/")
        assets[asset_id] = resolved
    return assets


def _validate_replace_candidates(
    store: FilesystemProjectStore, project_id: str, commands: list
) -> None:
    timeline = store.load_timeline(project_id)
    item_segments: dict[tuple[str, str], str | None] = {}
    if timeline is not None:
        for track in timeline.tracks:
            for item in track.items:
                item_segments[(track.id, item.id)] = item.segment_id
    project_candidates = [
        *store.load_media_candidates(project_id),
        *store.load_selected_media(project_id),
    ]
    for command in commands:
        if getattr(command, "type", None) != "replace":
            continue
        candidate = command.new_candidate
        current_segment = item_segments.get((command.track_id, command.item_id))
        if current_segment and candidate.segment_id != current_segment:
            raise ValueError(
                f"replacement candidate {candidate.id!r} must belong to the same segment"
            )
        stored = next(
            (
                stored_candidate
                for stored_candidate in project_candidates
                if stored_candidate.id == candidate.id
                and stored_candidate.segment_id == current_segment
            ),
            None,
        )
        if stored is None:
            raise ValueError(
                f"replacement candidate {candidate.id!r} is not in project media candidates"
            )
        for field_name in ("local_path", "download_url", "source_url"):
            incoming = getattr(candidate, field_name)
            stored_value = getattr(stored, field_name)
            if (incoming or stored_value) and incoming != stored_value:
                raise ValueError(
                    f"replacement candidate {candidate.id!r} does not match project media candidates"
                )


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


def _reddit_service():
    return RedditIngestService()


@router.post("/projects/from-reddit", response_model=BaseProjectResponse,
             summary="Create a project from a Reddit thread or manual payload")
def create_from_reddit(request: Request, body: CreateFromRedditRequest):
    _require_project_mode(request)
    if not getattr(config, "reddit_ingest_enabled", False):
        raise HttpException(task_id="", status_code=404, message="reddit ingest disabled")
    svc = _reddit_service()
    if body.url:
        source = svc.fetch(body.url)
    elif body.body:
        source = svc.from_manual(body.title or "", body.body, body.comments)
    else:
        raise HttpException(task_id="", status_code=400, message="url or body required")
    script = RedditThreadNormalizer().to_script_text(source)
    task_id = utils.get_uuid()
    _store().save_script(task_id, script)
    return _ok({"project_id": task_id, "has_script": bool(script), "source_kind": source.kind})


@router.get("/projects/{project_id}", response_model=BaseProjectResponse,
            summary="Get project state")
def get_project(request: Request, project_id: str):
    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    script = store.load_script(project_id)
    shot_plan = store.load_shot_plan(project_id)
    timeline = store.load_timeline(project_id)
    selected_media = store.load_selected_media(project_id)
    media_candidates = store.load_media_candidates(project_id)
    selected_music = store.load_selected_music(project_id)
    return _ok({
        "project_id": project_id,
        "has_script": script is not None,
        "has_shot_plan": shot_plan is not None,
        "has_selected_media": bool(selected_media),
        "has_timeline": timeline is not None,
        "script": script,
        "shot_plan": _dump_model(shot_plan),
        "timeline": _dump_model(timeline),
        "media_candidates": _dump_models(media_candidates),
        "selected_media": _dump_models(selected_media),
        "selected_music": _dump_models(selected_music),
        "preview_assets": [
            {"asset_id": asset_id, "path": asset_id}
            for asset_id in sorted(_project_asset_registry(store, project_id))
        ],
    })


@router.post("/projects/{project_id}/plan", response_model=BaseProjectResponse,
             summary="Run the shot planner")
def plan_project(request: Request, project_id: str, body: PlanRequest):
    _require_project_mode(request, project_id)
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
    _require_project_mode(request, project_id)
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
    _require_project_mode(request, project_id)
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
    _require_project_mode(request, project_id)
    store = _store()
    project = store.load_timeline(project_id)
    if project is None:
        raise HttpException(task_id=project_id, status_code=400, message="no timeline")
    try:
        _validate_replace_candidates(store, project_id, body.commands)
        project = project.apply_all(body.commands, media_path_exists=os.path.exists)
    except (KeyError, TypeError, ValueError) as exc:
        raise HttpException(task_id=project_id, status_code=400, message=str(exc))
    store.save_timeline(project_id, project)
    return _ok({"project_id": project_id, "applied": len(body.commands)})


@router.post("/projects/{project_id}/timeline/validate", response_model=BaseProjectResponse,
             summary="Validate the timeline invariants")
def timeline_validate(request: Request, project_id: str):
    _require_project_mode(request, project_id)
    store = _store()
    project = store.load_timeline(project_id)
    if project is None:
        raise HttpException(task_id=project_id, status_code=400, message="no timeline")
    try:
        validate_timeline_project(project)
    except ValueError as exc:
        raise HttpException(task_id=project_id, status_code=400, message=str(exc))
    return _ok({"project_id": project_id, "valid": True})


@router.post("/projects/{project_id}/music/select", response_model=BaseProjectResponse,
             summary="Select contextual music for a project")
def music_select(request: Request, project_id: str, body: MusicSelectRequest):
    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    plan = store.load_shot_plan(project_id)
    intent = _music_intent(body, plan)
    if intent is None:
        store.save_selected_music(project_id, [])
        return _ok({"project_id": project_id, "selected": None, "selected_count": 0})
    mode = "commercial_safe" if body.commercial_safe_only else "local_only"
    selected = MusicSelector().select(intent, _music_providers(body.local_only), mode=mode)
    tracks = []
    if selected is not None:
        selected = selected.model_copy(update={"volume": body.volume})
        tracks = [selected]
    store.save_selected_music(project_id, tracks)
    return _ok({
        "project_id": project_id,
        "selected": _dump_model(selected),
        "selected_count": len(tracks),
    })


@router.get("/projects/{project_id}/music", response_model=BaseProjectResponse,
            summary="Get selected contextual music")
def music_get(request: Request, project_id: str):
    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    return _ok({
        "project_id": project_id,
        "tracks": _dump_models(store.load_selected_music(project_id)),
    })


@router.put("/projects/{project_id}", response_model=BaseProjectResponse,
            summary="Replace the timeline project")
def replace_timeline(request: Request, project_id: str, project: TimelineProject):
    _require_project_mode(request, project_id)
    try:
        validate_timeline_project(project)
    except ValueError as exc:
        raise HttpException(task_id=project_id, status_code=400, message=str(exc))
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
    _require_project_mode(request, project_id)
    store = _store()
    project = store.load_timeline(project_id)
    if project is None:
        raise HttpException(task_id=project_id, status_code=400, message="build timeline first")
    existing_spec = store.load_render_spec(project_id)
    renderer_name = body.renderer
    if renderer_name is None and existing_spec is not None:
        renderer_name = existing_spec.renderer
    if renderer_name is None:
        renderer_name = getattr(config, "timeline_renderer", "moviepy")
    if renderer_name not in {"moviepy", "opencut"}:
        renderer_name = "moviepy"
    spec = RenderSpec(
        project_id=project.project_id, task_id=project_id,
        renderer=renderer_name,
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
    _require_project_mode(request, project_id)
    task = sm.state.get_task(project_id)
    if task is None:
        raise HttpException(task_id=project_id, status_code=404, message="no render started")
    return _ok(task)


@router.get("/projects/{project_id}/assets", response_model=BaseProjectResponse,
            summary="List project assets")
def list_assets(request: Request, project_id: str):
    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    task_dir = store.project_dir(project_id)
    assets = sorted(
        os.path.relpath(p, task_dir)
        for p in glob.glob(os.path.join(task_dir, "**", "*"), recursive=True)
        if os.path.isfile(p)
    )
    preview_assets = [
        {"asset_id": asset_id, "path": asset_id}
        for asset_id in sorted(_project_asset_registry(store, project_id))
    ]
    return _ok({"project_id": project_id, "assets": assets, "preview_assets": preview_assets})


@router.get("/projects/{project_id}/assets/{asset_id:path}", summary="Serve a project asset")
def get_asset(request: Request, project_id: str, asset_id: str):
    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    safe_asset_id = _safe_asset_id(asset_id)
    path = _project_asset_registry(store, project_id).get(safe_asset_id)
    if path is None:
        raise HttpException(task_id=project_id, status_code=404, message="asset not found")
    return FileResponse(path)
