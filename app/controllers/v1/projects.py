from __future__ import annotations

import glob
import json
import logging
import os
import datetime
import shutil

from fastapi import BackgroundTasks, Query, Request
from fastapi.responses import FileResponse

from app.application.services.media_aggregator import MediaAggregator
from app.application.services.music_selector import MusicSelector
from app.application.services.project_lifecycle import create_project
from app.application.services.shot_planner import ShotPlanner
from app.application.services.reddit_ingest import (
    RedditIngestService,
    RedditThreadNormalizer,
)
from app.application.services.timeline_builder import TimelineBuilder
from app.application.services.project_preflight import ProjectPreflightService
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
from app.domain.prompts.renderer import PromptRenderError, render_template_pair
from app.domain.rendering.models import RenderSpec
from app.infrastructure.music_providers.jamendo_provider import JamendoProvider
from app.infrastructure.music_providers.local_music_provider import LocalMusicProvider
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.infrastructure.storage.prompt_template_store import (
    PromptTemplateStore,
    PromptTemplateStoreError,
)
from app.infrastructure.storage.workspace_store import WorkspaceStore
from app.models import const
from app.models.exception import HttpException
from app.models.project_schema import (
    BaseProjectResponse,
    CreateFromScriptRequest,
    CreateFromTopicRequest,
    CreateFromRedditRequest,
    MediaSearchRequest,
    MusicSelectRequest,
    NarrationRequest,
    PlanRequest,
    RenderRequest,
    RenameProjectRequest,
    TimelineBuildRequest,
    TimelineCommandsRequest,
)
from app.models.schema import VideoParams
from app.services import llm
from app.services import state as sm
from app.services import task as legacy_task
from app.services.quality.observability import phase_timer
from app.utils import utils

router = new_router()
logger = logging.getLogger(__name__)


def _store() -> FilesystemProjectStore:
    return FilesystemProjectStore()


def _register_project_run(
    *,
    task_id: str,
    workspace_id: str | None,
    source: str,
    topic: str | None,
    prompt_template_id: str | None,
    prompt_version_id: str | None,
    provider: str | None = None,
    model: str | None = None,
) -> None:
    try:
        from app.infrastructure.database.repositories.project_runs import (
            ProjectRunRepository,
        )

        ProjectRunRepository().create(
            project_id=task_id,
            task_id=task_id,
            workspace_id=workspace_id,
            source=source,
            topic=topic,
            prompt_template_id=prompt_template_id,
            prompt_version_id=prompt_version_id,
            provider=provider,
            model=model,
        )
    except Exception:
        logger.warning("project_run registration failed for %s", task_id, exc_info=True)


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


def _generated_task_path(task_id: str) -> str:
    return os.path.join(utils.task_dir(), task_id)


def _task_meta_path(task_id: str) -> str:
    return os.path.join(_generated_task_path(task_id), "_meta", "script.json")


def _task_deleted_marker_path(task_id: str) -> str:
    return os.path.join(_generated_task_path(task_id), "_meta", "deleted.json")


def _load_task_script_meta(task_id: str) -> dict | None:
    meta_path = _task_meta_path(task_id)
    if not os.path.isfile(meta_path):
        return None
    try:
        with open(meta_path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _save_task_script_meta(task_id: str, meta: dict) -> None:
    meta_path = _task_meta_path(task_id)
    os.makedirs(os.path.dirname(meta_path), exist_ok=True)
    with open(meta_path, "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False, indent=4)


def _is_generated_task_deleted(task_id: str) -> bool:
    return os.path.isfile(_task_deleted_marker_path(task_id))


def _mark_generated_task_deleted(task_id: str) -> None:
    marker_path = _task_deleted_marker_path(task_id)
    os.makedirs(os.path.dirname(marker_path), exist_ok=True)
    with open(marker_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "deleted": True,
                "deleted_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            },
            fh,
            ensure_ascii=False,
            indent=4,
        )


def _remove_generated_task_dir(task_id: str) -> bool:
    task_path = _safe_generated_task_dir(task_id)
    if not os.path.isdir(task_path):
        return True
    try:
        shutil.rmtree(task_path)
        return True
    except OSError:
        _mark_generated_task_deleted(task_id)
        return False


def _safe_generated_task_dir(task_id: str) -> str:
    _validate_project_id(task_id)
    tasks_root = os.path.realpath(utils.task_dir())
    task_path = os.path.realpath(_generated_task_path(task_id))
    try:
        if os.path.commonpath([tasks_root, task_path]) != tasks_root:
            raise ValueError("task path is outside storage/tasks")
    except ValueError as exc:
        raise HttpException(task_id=task_id, status_code=400, message="invalid project path") from exc
    return task_path


def _task_topic_from_meta(meta: dict, fallback: str = "") -> str:
    params = meta.get("params") or {}
    script = meta.get("script") or ""
    return (params.get("video_subject") or script[:80].strip() or fallback).strip()


def _copy_generated_task_config(project_id: str) -> str:
    meta = _load_task_script_meta(project_id)
    if meta is None:
        raise HttpException(task_id=project_id, status_code=404, message="project not found")

    new_id = utils.get_uuid()
    copied_meta = json.loads(json.dumps(meta, ensure_ascii=False))
    params = copied_meta.setdefault("params", {})
    topic = _task_topic_from_meta(copied_meta, project_id)
    params["video_subject"] = f"Copia de {topic}"[:120]
    _save_task_script_meta(new_id, copied_meta)
    return new_id


def _list_generated_video_tasks(limit: int = 20) -> list[dict]:
    tasks_dir = utils.task_dir()
    if not os.path.isdir(tasks_dir):
        return []

    entries: list[dict] = []
    for task_id in os.listdir(tasks_dir):
        task_path = os.path.join(tasks_dir, task_id)
        if not os.path.isdir(task_path):
            continue

        meta = _load_task_script_meta(task_id)
        if meta is None:
            continue
        if _is_generated_task_deleted(task_id):
            continue

        video_files = [
            os.path.join(task_path, name)
            for name in os.listdir(task_path)
            if name.startswith(("final-", "combined-")) and name.endswith(".mp4")
        ]
        paths = [path for path in video_files if os.path.isfile(path)]
        paths.append(_task_meta_path(task_id))
        mtime = max(os.path.getmtime(path) for path in paths if os.path.isfile(path))
        params = meta.get("params") or {}
        topic = _task_topic_from_meta(meta, task_id)
        entries.append({
            "project_id": task_id,
            "topic": topic,
            "updated_at": datetime.datetime.fromtimestamp(
                mtime, tz=datetime.timezone.utc
            ).isoformat(),
            "kind": "task",
        })

    entries.sort(key=lambda item: item["updated_at"], reverse=True)
    return entries[:limit]


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
    local_paths.extend(
        c.local_path for c in store.load_media_candidates(project_id) if c.local_path
    )
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


def _resolve_asset_url(
    project_dir: str, registry: dict[str, str], project_id: str, local_path: str | None,
) -> str | None:
    if not local_path:
        return None
    if local_path.startswith("http://") or local_path.startswith("https://"):
        return local_path
    candidate = local_path if os.path.isabs(local_path) else os.path.join(project_dir, local_path)
    resolved = os.path.realpath(candidate)
    for asset_id, asset_path in registry.items():
        if asset_path == resolved:
            return f"/api/v1/projects/{project_id}/assets/{asset_id}"
    return None


def _inject_asset_urls(store: FilesystemProjectStore, project_id: str, timeline_dict: dict | None) -> None:
    if timeline_dict is None:
        return
    project_dir = store.project_dir(project_id)
    registry = _project_asset_registry(store, project_id)
    for track in timeline_dict.get("tracks", []):
        for item in track.get("items", []):
            item["asset_url"] = _resolve_asset_url(
                project_dir, registry, project_id, item.get("local_path")
            )


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
                    f"replacement candidate {candidate.id!r} does not match"
                    " project media candidates"
                )


@router.get("/projects", response_model=BaseProjectResponse,
            summary="List recent projects")
def list_projects(request: Request, limit: int = 20):
    if not getattr(config, "project_mode_enabled", False):
        return _ok({"projects": _list_generated_video_tasks(limit=limit)})

    _require_project_mode(request)
    store = _store()
    projects = store.list_projects(limit=limit)
    return _ok({"projects": projects})


@router.post("/projects/from-topic", response_model=BaseProjectResponse,
             summary="Create a project from a topic")
def create_from_topic(request: Request, body: CreateFromTopicRequest):
    _require_project_mode(request)
    task_id = utils.get_uuid()
    store = _store()
    script = ""
    resolved_version_id = body.prompt_version_id
    provider = None
    model_hint = None
    rendered_prompt = None
    if body.generate_script:
        if body.prompt_template_id:
            variables = _resolve_prompt_variables(
                topic=body.topic, language=body.language, duration=body.target_duration_sec,
                style=body.global_visual_style, workspace_id=body.workspace_id,
            )
            rendered_system, rendered_user, resolved_version_id, model_hint = _render_prompt_template(
                prompt_template_id=body.prompt_template_id,
                prompt_version_id=body.prompt_version_id,
                variables=variables,
            )
            rendered_prompt = {"system_prompt": rendered_system, "user_prompt": rendered_user}
            provider = config.app.get("llm_provider", "")
            script = llm.generate_script(
                video_subject=body.topic, language=body.language,
                paragraph_number=body.paragraph_number,
                video_script_prompt=rendered_user, custom_system_prompt=rendered_system,
            )
        else:
            script = llm.generate_script(
                video_subject=body.topic, language=body.language,
                paragraph_number=body.paragraph_number,
            )
    store.save_script(task_id, script)
    store.save_project_metadata(
        task_id, topic=body.topic, workspace_id=body.workspace_id,
        prompt_template_id=body.prompt_template_id, prompt_version_id=resolved_version_id,
        provider=provider, model=model_hint, rendered_prompt=rendered_prompt,
    )
    _register_project_run(
        task_id=task_id, workspace_id=body.workspace_id, source="topic", topic=body.topic,
        prompt_template_id=body.prompt_template_id, prompt_version_id=resolved_version_id,
        provider=provider, model=model_hint,
    )
    return _ok({"project_id": task_id, "has_script": bool(script)})


@router.post("/projects/from-script", response_model=BaseProjectResponse,
             summary="Create a project from a pasted script")
def create_from_script(request: Request, body: CreateFromScriptRequest):
    _require_project_mode(request)
    if not body.script.strip():
        raise HttpException(task_id="", status_code=400, message="script is empty")
    store = _store()
    task_id = create_project(
        store, topic=body.topic, script=body.script, workspace_id=body.workspace_id,
        prompt_template_id=body.prompt_template_id, prompt_version_id=body.prompt_version_id,
    )
    _register_project_run(
        task_id=task_id, workspace_id=body.workspace_id, source="script", topic=body.topic,
        prompt_template_id=body.prompt_template_id, prompt_version_id=body.prompt_version_id,
    )
    return _ok({"project_id": task_id, "has_script": True})


def _reddit_service():
    return RedditIngestService()


def _prompt_template_store() -> PromptTemplateStore:
    return PromptTemplateStore()


def _resolve_prompt_variables(
    *, topic: str, language: str, duration: float | None, style: str | None, workspace_id: str | None,
) -> dict[str, str]:
    platform = ""
    workspace_name = ""
    if workspace_id:
        workspace = WorkspaceStore().load(workspace_id)
        if workspace is not None:
            platform = workspace.platform or ""
            workspace_name = workspace.name
    return {
        "topic": topic or "",
        "language": language or "",
        "duration": str(int(duration)) if duration else "",
        "platform": platform,
        "workspace": workspace_name,
        "style": style or "",
    }


def _validate_prompt_id(value: str) -> None:
    normalized = value.replace("\\", "/")
    parts = normalized.split("/")
    if (
        not normalized
        or normalized.startswith("/")
        or any(part in ("", ".", "..") for part in parts)
    ):
        raise HttpException(task_id="", status_code=400, message="invalid prompt template id")


def _render_prompt_template(
    *, prompt_template_id: str, prompt_version_id: str | None, variables: dict[str, str],
):
    """Returns (rendered_system_prompt, rendered_user_prompt, resolved_version_id, model_hint)."""
    if not getattr(config, "prompt_templates_enabled", False):
        raise HttpException(task_id="", status_code=400, message="prompt templates disabled")
    _validate_prompt_id(prompt_template_id)
    if prompt_version_id:
        _validate_prompt_id(prompt_version_id)
    store = _prompt_template_store()
    try:
        template = store.load_template(prompt_template_id)
    except PromptTemplateStoreError as exc:
        raise HttpException(task_id="", status_code=400, message="prompt template not found") from exc
    if template is None:
        raise HttpException(task_id="", status_code=400, message="prompt template not found")
    version_id = prompt_version_id or template.active_version_id
    if not version_id:
        raise HttpException(task_id="", status_code=400, message="prompt template has no active version")
    try:
        version = store.load_version(prompt_template_id, version_id)
    except PromptTemplateStoreError as exc:
        raise HttpException(task_id="", status_code=400, message="prompt version not found") from exc
    if version is None:
        raise HttpException(task_id="", status_code=400, message="prompt version not found")
    try:
        rendered_system, rendered_user = render_template_pair(
            version.system_prompt, version.user_prompt_template, variables
        )
    except PromptRenderError as exc:
        raise HttpException(task_id="", status_code=400, message=f"prompt render failed: {exc}") from exc
    return rendered_system, rendered_user, version.id, version.model_hint


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
    store = _store()
    store.save_script(task_id, script)
    store.save_project_metadata(
        task_id,
        topic=body.topic or body.title or getattr(source, "title", None),
        workspace_id=body.workspace_id,
    )
    return _ok({"project_id": task_id, "has_script": bool(script), "source_kind": source.kind})


@router.get("/projects/{project_id}", response_model=BaseProjectResponse,
            summary="Get project state")
def get_project(request: Request, project_id: str):
    if not getattr(config, "project_mode_enabled", False):
        _validate_project_id(project_id)
        if _is_generated_task_deleted(project_id):
            raise HttpException(task_id=project_id, status_code=404, message="project not found")
        meta = _load_task_script_meta(project_id)
        if meta is None:
            raise HttpException(task_id=project_id, status_code=404, message="project not found")
        params = meta.get("params") or {}
        task_path = _generated_task_path(project_id)
        final_videos = sorted(
            f"/api/v1/stream/{project_id}/{name}"
            for name in os.listdir(task_path)
            if name.startswith("final-") and name.endswith(".mp4")
        ) if os.path.isdir(task_path) else []
        combined_videos = sorted(
            f"/api/v1/stream/{project_id}/{name}"
            for name in os.listdir(task_path)
            if name.startswith("combined-") and name.endswith(".mp4")
        ) if os.path.isdir(task_path) else []
        return _ok({
            "project_id": project_id,
            "has_script": bool(meta.get("script")),
            "has_shot_plan": False,
            "has_selected_media": False,
            "has_timeline": False,
            "script": meta.get("script"),
            "shot_plan": None,
            "timeline": None,
            "media_candidates": [],
            "selected_media": [],
            "selected_music": [],
            "preview_assets": [],
            "topic": params.get("video_subject"),
            "params": params,
            "videos": final_videos,
            "combined_videos": combined_videos,
        })
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
    timeline_dict = _dump_model(timeline)
    _inject_asset_urls(store, project_id, timeline_dict)
    project_meta = store.load_project_metadata(project_id) or {}
    return _ok({
        "project_id": project_id,
        "workspace_id": project_meta.get("workspace_id"),
        "prompt_template_id": project_meta.get("prompt_template_id"),
        "prompt_version_id": project_meta.get("prompt_version_id"),
        "provider": project_meta.get("provider"),
        "model": project_meta.get("model"),
        "has_script": script is not None,
        "has_shot_plan": shot_plan is not None,
        "has_selected_media": bool(selected_media),
        "has_timeline": timeline is not None,
        "script": script,
        "shot_plan": _dump_model(shot_plan),
        "timeline": timeline_dict,
        "media_candidates": _dump_models(media_candidates),
        "selected_media": _dump_models(selected_media),
        "selected_music": _dump_models(selected_music),
        "preview_assets": [
            {"asset_id": asset_id, "path": asset_id}
            for asset_id in sorted(_project_asset_registry(store, project_id))
        ],
    })


@router.delete("/projects/{project_id}", response_model=BaseProjectResponse,
               summary="Delete a project")
def delete_project(request: Request, project_id: str):
    if not getattr(config, "project_mode_enabled", False):
        if _load_task_script_meta(project_id) is None:
            raise HttpException(task_id=project_id, status_code=404, message="project not found")

        removed = _remove_generated_task_dir(project_id)
        sm.state.delete_task(project_id)
        return _ok({"project_id": project_id, "deleted": True, "pending_cleanup": not removed})

    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    store.delete_project(project_id)
    return _ok({"project_id": project_id, "deleted": True})


@router.patch("/projects/{project_id}/metadata", response_model=BaseProjectResponse,
              summary="Rename a project")
def rename_project(request: Request, project_id: str, body: RenameProjectRequest):
    topic = body.topic.strip()
    if not topic:
        raise HttpException(task_id=project_id, status_code=400, message="topic is empty")

    if not getattr(config, "project_mode_enabled", False):
        _safe_generated_task_dir(project_id)
        meta = _load_task_script_meta(project_id)
        if meta is None:
            raise HttpException(task_id=project_id, status_code=404, message="project not found")
        params = meta.setdefault("params", {})
        params["video_subject"] = topic
        _save_task_script_meta(project_id, meta)
        return _ok({"project_id": project_id, "topic": topic})

    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    store.save_project_metadata(project_id, topic=topic)
    return _ok({"project_id": project_id, "topic": topic})


@router.post("/projects/{project_id}/duplicate", response_model=BaseProjectResponse,
             summary="Duplicate a project's video config into a new project")
def duplicate_project(request: Request, project_id: str):
    if not getattr(config, "project_mode_enabled", False):
        _safe_generated_task_dir(project_id)
        new_id = _copy_generated_task_config(project_id)
        return _ok({"project_id": new_id})

    _require_project_mode(request, project_id)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    new_id = store.duplicate_video_config(project_id)
    return _ok({"project_id": new_id})


@router.post("/projects/{project_id}/plan", response_model=BaseProjectResponse,
             summary="Run the shot planner")
def plan_project(request: Request, project_id: str, body: PlanRequest):
    _require_project_mode(request, project_id)
    store = _store()
    script = store.load_script(project_id) or ""
    if not script.strip():
        raise HttpException(task_id=project_id, status_code=400, message="project has no script")
    with phase_timer("plan", project_id=project_id):
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
    with phase_timer("media_search", project_id=project_id):
        selection = _media_aggregator(store).select_for_plan(
            plan, orientation=body.orientation, prefer_local=body.prefer_local, task_id=project_id,
        )
    return _ok({"project_id": project_id, "selected_count": len(selection)})


@router.post("/projects/{project_id}/narration", response_model=BaseProjectResponse,
             summary="Synthesize narration audio and subtitles from the script")
def narration_synthesize(request: Request, project_id: str, body: NarrationRequest):
    _require_project_mode(request, project_id)
    store = _store()
    script = store.load_script(project_id) or ""
    if not script.strip():
        raise HttpException(task_id=project_id, status_code=400, message="project has no script")
    params = VideoParams(
        video_subject=project_id,
        video_script=script,
        voice_name=body.voice_name,
        voice_rate=body.voice_rate,
        subtitle_enabled=body.subtitle_enabled,
    )
    with phase_timer("narration", project_id=project_id):
        audio_file, audio_duration, sub_maker = legacy_task.generate_audio(
            project_id, params, script
        )
        if not audio_file:
            raise HttpException(
                task_id=project_id, status_code=500, message="failed to generate narration audio"
            )
        subtitle_path = legacy_task.generate_subtitle(
            project_id, params, script, sub_maker, audio_file
        )
    return _ok({
        "project_id": project_id,
        "narration_audio_path": audio_file,
        "audio_duration_sec": audio_duration,
        "subtitle_path": subtitle_path or None,
    })


@router.post("/projects/{project_id}/timeline/build", response_model=BaseProjectResponse,
             summary="Build the timeline from plan + selected media")
def timeline_build(request: Request, project_id: str, body: TimelineBuildRequest):
    _require_project_mode(request, project_id)
    store = _store()
    if store.load_shot_plan(project_id) is None:
        raise HttpException(task_id=project_id, status_code=400, message="run /plan first")
    with phase_timer("timeline_build", project_id=project_id):
        project = _timeline_builder(store).build_from_store(
            project_id, title=body.title,
            narration_audio_path=body.narration_audio_path, subtitle_path=body.subtitle_path,
        )
    return _ok({"project_id": project_id, "track_count": len(project.tracks)})


@router.post("/projects/{project_id}/timeline/commands", response_model=BaseProjectResponse,
             summary="Apply edit commands to the timeline")
def timeline_commands(
    request: Request,
    project_id: str,
    body: TimelineCommandsRequest,
    validate: bool = Query(False),
):
    _require_project_mode(request, project_id)
    store = _store()
    project = store.load_timeline(project_id)
    if project is None:
        raise HttpException(task_id=project_id, status_code=400, message="no timeline")
    try:
        _validate_replace_candidates(store, project_id, body.commands)
        project = project.apply_all(
            body.commands,
            validate=False,
            media_path_exists=os.path.exists,
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise HttpException(task_id=project_id, status_code=400, message=str(exc))
    store.save_timeline(project_id, project)
    result = {"project_id": project_id, "applied": len(body.commands)}
    if validate:
        try:
            validate_timeline_project(project)
            result["valid"] = True
            result["errors"] = []
        except ValueError as exc:
            result["valid"] = False
            result["errors"] = [str(exc)]
    return _ok(result)


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
    with phase_timer("music_select", project_id=project_id):
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
        with phase_timer("render", project_id=project_id):
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
    preflight = ProjectPreflightService(store).run(project_id)
    if not preflight.valid:
        raise HttpException(
            task_id=project_id, status_code=400,
            message="preflight failed: " + "; ".join(preflight.errors),
        )
    if preflight.warnings and not body.allow_preflight_warnings:
        raise HttpException(
            task_id=project_id, status_code=400,
            message=(
                "preflight has warnings; set allow_preflight_warnings=true to proceed: "
                + "; ".join(preflight.warnings)
            ),
        )
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
        subtitle_style=body.subtitle_style,
        font_name=body.font_name,
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


@router.get("/projects/{project_id}/preflight", response_model=BaseProjectResponse,
            summary="Run pre-render readiness checks")
def preflight_check(request: Request, project_id: str):
    _require_project_mode(request, project_id)
    store = _store()
    if store.load_timeline(project_id) is None:
        raise HttpException(task_id=project_id, status_code=400, message="build timeline first")
    result = ProjectPreflightService(store).run(project_id)
    return _ok(result.model_dump(mode="json"))


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
