from __future__ import annotations

from dataclasses import dataclass, field

from app.domain.projects.models import TimelineItem, TimelineProject
from app.domain.rendering.models import RenderSpec
from app.infrastructure.storage.base import ProjectStore
from app.models.schema import VideoAspect, VideoParams


@dataclass
class RenderInputs:
    video_items: list[TimelineItem] = field(default_factory=list)
    narration_path: str | None = None
    subtitle_path: str | None = None
    total_duration_sec: float = 0.0


def _aspect_for(width: int, height: int) -> VideoAspect:
    if (width, height) == (1920, 1080):
        return VideoAspect.landscape
    if (width, height) == (1080, 1080):
        return VideoAspect.square
    return VideoAspect.portrait


class MoviePyTimelineRenderer:
    name = "moviepy"

    def __init__(self, store: ProjectStore | None = None) -> None:
        self._store = store

    def _resolve_render_inputs(self, project: TimelineProject) -> RenderInputs:
        inputs = RenderInputs()
        for track in project.tracks:
            if track.type == "video":
                inputs.video_items.extend(track.items)
            elif track.type == "audio" and track.items and inputs.narration_path is None:
                inputs.narration_path = track.items[0].local_path
            elif track.type == "subtitle" and track.items and inputs.subtitle_path is None:
                inputs.subtitle_path = track.items[0].local_path
        inputs.total_duration_sec = sum(item.duration_sec for item in inputs.video_items)
        return inputs

    def _build_video_params(
        self, project: TimelineProject, spec: RenderSpec
    ) -> VideoParams:
        params = VideoParams(video_subject=project.title or project.task_id or "timeline")
        params.video_script = project.script or ""
        params.video_aspect = _aspect_for(spec.width, spec.height)
        params.subtitle_enabled = spec.include_subtitles
        if not spec.include_background_music:
            params.bgm_type = ""
            params.bgm_file = ""
        return params
