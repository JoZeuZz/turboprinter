from __future__ import annotations

import os

from app.config import config
from app.domain.rendering.models import RenderManifest, RenderResult, RenderSpec
from app.infrastructure.renderers.base import TimelineRenderer
from app.infrastructure.renderers.moviepy_renderer import MoviePyTimelineRenderer
from app.infrastructure.renderers.opencut_adapter import OpenCutAdapter
from app.infrastructure.storage.base import ProjectStore


def _select_timeline_renderer(renderer_name: str, store: ProjectStore | None = None) -> TimelineRenderer:
    name = (renderer_name or "moviepy").lower()
    if name == "opencut":
        return OpenCutAdapter()
    if name == "moviepy":
        return MoviePyTimelineRenderer(store=store)
    raise ValueError(f"unsupported timeline renderer: {renderer_name!r}")


def get_timeline_renderer(
    renderer_name: str | None = None, store: ProjectStore | None = None
) -> TimelineRenderer | None:
    if not getattr(config, "project_mode_enabled", False):
        return None
    name = (renderer_name or getattr(config, "timeline_renderer", "moviepy")).lower()
    return _select_timeline_renderer(name, store=store)


def _persist_render_failure(
    task_id: str,
    store: ProjectStore,
    project,
    spec: RenderSpec,
    renderer_name: str,
    output_dir: str,
    error: str,
) -> RenderResult:
    output_path = os.path.join(output_dir, f"final.{spec.output_format}")
    result = RenderResult(
        project_id=project.project_id,
        output_path=output_path,
        renderer_used=renderer_name,
        success=False,
        error=error,
    )
    manifest = RenderManifest(
        project_id=project.project_id,
        task_id=spec.task_id or project.task_id or task_id,
        renderer=renderer_name,
        output_path=output_path,
        video_item_count=sum(len(t.items) for t in project.tracks if t.type == "video"),
        total_duration_sec=sum(
            item.duration_sec
            for track in project.tracks
            if track.type == "video"
            for item in track.items
        ),
        warnings=[error],
    )
    store.save_render_manifest(task_id, manifest)
    store.save_render_result(task_id, result)
    return result


def render_project_from_store(
    task_id: str,
    store: ProjectStore,
    renderer: TimelineRenderer | None = None,
    output_dir: str | None = None,
) -> RenderResult:
    project = store.load_timeline(task_id)
    if project is None:
        raise ValueError(f"timeline_project.json not found for task {task_id!r}")
    spec = store.load_render_spec(task_id)
    if spec is None:
        renderer_name = getattr(config, "timeline_renderer", "moviepy")
        if renderer_name not in {"moviepy", "opencut"}:
            renderer_name = "moviepy"
        spec = RenderSpec(
            project_id=project.project_id, task_id=task_id,
            renderer=renderer_name,
            width=project.export.width, height=project.export.height,
            fps=project.export.fps, codec=project.export.codec,
            audio_codec=project.export.audio_codec,
        )
    if renderer is None:
        renderer = _select_timeline_renderer(spec.renderer, store=store)
    if output_dir is None:
        from app.utils import utils

        output_dir = utils.task_dir(task_id)
    try:
        return renderer.render(project, spec, output_dir)
    except NotImplementedError as exc:
        return _persist_render_failure(
            task_id=task_id,
            store=store,
            project=project,
            spec=spec,
            renderer_name=getattr(renderer, "name", spec.renderer),
            output_dir=output_dir,
            error=str(exc),
        )
