from __future__ import annotations

from app.config import config
from app.domain.rendering.models import RenderResult, RenderSpec
from app.infrastructure.renderers.base import TimelineRenderer
from app.infrastructure.renderers.moviepy_renderer import MoviePyTimelineRenderer
from app.infrastructure.renderers.opencut_adapter import OpenCutAdapter
from app.infrastructure.storage.base import ProjectStore


def get_timeline_renderer(
    renderer_name: str | None = None, store: ProjectStore | None = None
) -> TimelineRenderer | None:
    if not getattr(config, "project_mode_enabled", False):
        return None
    name = (renderer_name or getattr(config, "timeline_renderer", "moviepy")).lower()
    if name == "opencut":
        return OpenCutAdapter()
    return MoviePyTimelineRenderer(store=store)


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
        spec = RenderSpec(
            project_id=project.project_id, task_id=task_id,
            width=project.export.width, height=project.export.height,
            fps=project.export.fps, codec=project.export.codec,
            audio_codec=project.export.audio_codec,
        )
    if renderer is None:
        renderer = MoviePyTimelineRenderer(store=store)
    if output_dir is None:
        from app.utils import utils

        output_dir = utils.task_dir(task_id)
    return renderer.render(project, spec, output_dir)
