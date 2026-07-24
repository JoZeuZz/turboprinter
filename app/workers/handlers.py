from __future__ import annotations

import json
from typing import Callable

from app.application.services.media_aggregator import MediaAggregator
from app.application.services.metrics import MetricsService
from app.application.services.publication_service import PublicationService
from app.application.services.project_lifecycle import create_project
from app.application.services.project_preflight import ProjectPreflightService
from app.application.services.shot_planner import ShotPlanner
from app.application.services.timeline_builder import TimelineBuilder
from app.domain.operational.models import AGE_WINDOWS, Job
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.application.workflows.render_project import render_project_from_store
from app.infrastructure.llm.structured_output import LiteLLMStructuredProvider
from app.infrastructure.media_providers.local_provider import LocalLibraryProvider
from app.infrastructure.media_providers.stock_providers import (
    CoverrProvider,
    PexelsProvider,
    PixabayProvider,
)
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.models.schema import VideoParams
from app.services import task as legacy_task


def _payload(job: Job) -> dict:
    return json.loads(job.payload_json or "{}")


def _store() -> FilesystemProjectStore:
    return FilesystemProjectStore()


def _media_providers() -> list:
    providers = [PexelsProvider(), PixabayProvider(), CoverrProvider(), LocalLibraryProvider()]
    return [p for p in providers if p.is_configured()]


def _video_params(payload: dict, project_id: str, script: str) -> VideoParams:
    return VideoParams(
        video_subject=project_id,
        video_script=script,
        voice_name=payload.get("voice_name", ""),
        voice_rate=payload.get("voice_rate", 1.0),
        subtitle_enabled=payload.get("subtitle_enabled", True),
    )


def handle_generate_project(job: Job) -> None:
    payload = _payload(job)
    create_project(
        _store(), topic=payload.get("topic"), script=payload.get("script"),
        workspace_id=job.workspace_id,
    )


def handle_plan_project(job: Job) -> None:
    payload = _payload(job)
    store = _store()
    script = store.load_script(job.project_id) or ""
    if not script.strip():
        raise ValueError(f"project {job.project_id!r} has no script")
    ShotPlanner(LiteLLMStructuredProvider(), store=store).plan(
        script=script,
        language=payload.get("language", "es"),
        target_duration_sec=payload.get("target_duration_sec"),
        visual_style=payload.get("visual_style"),
        task_id=job.project_id,
    )


def handle_search_media(job: Job) -> None:
    payload = _payload(job)
    store = _store()
    plan = store.load_shot_plan(job.project_id)
    if plan is None:
        raise ValueError(f"project {job.project_id!r} has no shot plan; run plan_project first")
    MediaAggregator(_media_providers(), store=store).select_for_plan(
        plan,
        orientation=payload.get("orientation"),
        prefer_local=payload.get("prefer_local", False),
        task_id=job.project_id,
    )


def handle_synthesize_narration(job: Job) -> None:
    payload = _payload(job)
    store = _store()
    script = store.load_script(job.project_id) or ""
    if not script.strip():
        raise ValueError(f"project {job.project_id!r} has no script")
    params = _video_params(payload, job.project_id, script)
    audio_file, _duration, sub_maker = legacy_task.generate_audio(job.project_id, params, script)
    if not audio_file:
        raise RuntimeError(f"narration synthesis failed for project {job.project_id!r}")
    legacy_task.generate_subtitle(job.project_id, params, script, sub_maker, audio_file)


def handle_build_timeline(job: Job) -> None:
    payload = _payload(job)
    store = _store()
    if store.load_shot_plan(job.project_id) is None:
        raise ValueError(f"project {job.project_id!r} has no shot plan; run plan_project first")
    TimelineBuilder(store=store).build_from_store(
        job.project_id,
        title=payload.get("title"),
        narration_audio_path=payload.get("narration_audio_path"),
        subtitle_path=payload.get("subtitle_path"),
    )


def handle_render_project(job: Job) -> None:
    store = _store()
    project = store.load_timeline(job.project_id)
    if project is None:
        raise ValueError(f"project {job.project_id!r} has no timeline; run build_timeline first")
    preflight = ProjectPreflightService(store).run(job.project_id)
    if not preflight.valid:
        raise RuntimeError(f"preflight failed for {job.project_id!r}: {preflight.errors}")
    result = render_project_from_store(job.project_id, store)
    if not result.success:
        raise RuntimeError(f"render failed for {job.project_id!r}: {result.error}")


def handle_full_project_pipeline(job: Job) -> None:
    payload = _payload(job)
    store = _store()
    project_id = job.project_id
    if not project_id:
        raise ValueError("full_project_pipeline job requires project_id")

    script = store.load_script(project_id) or ""
    if not script.strip():
        raise ValueError(f"project {project_id!r} has no script")

    ShotPlanner(LiteLLMStructuredProvider(), store=store).plan(
        script=script,
        language=payload.get("language", "es"),
        target_duration_sec=payload.get("target_duration_sec"),
        visual_style=payload.get("visual_style"),
        task_id=project_id,
    )

    shot_plan = store.load_shot_plan(project_id)
    MediaAggregator(_media_providers(), store=store).select_for_plan(
        shot_plan,
        orientation=payload.get("orientation"),
        prefer_local=payload.get("prefer_local", False),
        task_id=project_id,
    )

    params = _video_params(payload, project_id, script)
    audio_file, _duration, sub_maker = legacy_task.generate_audio(project_id, params, script)
    if not audio_file:
        raise RuntimeError(f"narration synthesis failed for project {project_id!r}")
    subtitle_path = legacy_task.generate_subtitle(project_id, params, script, sub_maker, audio_file)

    TimelineBuilder(store=store).build_from_store(
        project_id, narration_audio_path=audio_file, subtitle_path=subtitle_path,
    )

    preflight = ProjectPreflightService(store).run(project_id)
    if not preflight.valid:
        raise RuntimeError(f"preflight failed for {project_id!r}: {preflight.errors}")
    if preflight.warnings and not payload.get("allow_preflight_warnings", False):
        raise RuntimeError(f"preflight warnings for {project_id!r}: {preflight.warnings}")

    result = render_project_from_store(project_id, store)
    if not result.success:
        raise RuntimeError(f"render failed for {project_id!r}: {result.error}")


def handle_publish_video(job: Job) -> None:
    payload = _payload(job)
    publication_id = payload.get("publication_id")
    if not publication_id:
        raise ValueError("publish_video job requires publication_id")
    publication = PublicationService().publish(str(publication_id), dry_run=payload.get("dry_run", True))
    if publication.status == "failed":
        raise RuntimeError(publication.error or "publication failed")


def handle_collect_metrics(job: Job) -> None:
    payload = _payload(job)
    provider_name = payload.get("provider", "stub")
    age_windows = payload.get("age_windows") or list(AGE_WINDOWS)
    publication_repo = PublicationRepository()
    if payload.get("publication_id"):
        publication = publication_repo.get(str(payload["publication_id"]))
        if publication is None:
            raise ValueError("publication not found")
        publications = [publication]
    elif payload.get("workspace_id"):
        publications = publication_repo.list_filtered(workspace_id=str(payload["workspace_id"]), status="published", limit=500)
    else:
        publications = publication_repo.list_filtered(status="published", limit=500)
    service = MetricsService()
    for publication in publications:
        service.collect_for_publication(publication, provider_name=provider_name, age_windows=list(age_windows))


HANDLERS: dict[str, Callable[[Job], None]] = {
    "generate_project": handle_generate_project,
    "plan_project": handle_plan_project,
    "search_media": handle_search_media,
    "synthesize_narration": handle_synthesize_narration,
    "build_timeline": handle_build_timeline,
    "render_project": handle_render_project,
    "full_project_pipeline": handle_full_project_pipeline,
    "publish_video": handle_publish_video,
    "collect_metrics": handle_collect_metrics,
}
