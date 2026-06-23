from __future__ import annotations

import os
from dataclasses import dataclass, field

from app.domain.projects.models import TimelineItem, TimelineProject
from app.domain.rendering.models import RenderManifest, RenderResult, RenderSpec
from app.infrastructure.storage.base import ProjectStore
from app.models.schema import VideoAspect, VideoParams
from app.services import video


@dataclass
class RenderInputs:
    video_items: list[TimelineItem] = field(default_factory=list)
    narration_path: str | None = None
    subtitle_path: str | None = None
    music_path: str | None = None
    music_volume: float | None = None
    total_duration_sec: float = 0.0


def _aspect_for(width: int, height: int) -> VideoAspect:
    if (width, height) == (1920, 1080):
        return VideoAspect.landscape
    if (width, height) == (1080, 1080):
        return VideoAspect.square
    return VideoAspect.portrait


def _concat_timeline_clips(
    items, width: int, height: int, out_path: str, threads: int = 2
) -> None:
    from moviepy import ColorClip, CompositeVideoClip, concatenate_videoclips

    clips = []
    try:
        for item in items:
            duration = item.duration_sec
            if not item.local_path or not os.path.exists(item.local_path):
                clips.append(
                    ColorClip(size=(width, height), color=(0, 0, 0)).with_duration(duration)
                )
                continue
            source = video._open_video_clip_quietly(item.local_path)
            start = item.trim_start_sec or 0.0
            end = item.trim_end_sec if item.trim_end_sec is not None else source.duration
            end = min(end, source.duration, start + duration)
            if end <= start:
                video.close_clip(source)
                clips.append(
                    ColorClip(size=(width, height), color=(0, 0, 0)).with_duration(duration)
                )
                continue
            clip = source.subclipped(start, end)
            clip_w, clip_h = clip.size
            if (clip_w, clip_h) != (width, height):
                clip_ratio = clip_w / clip_h
                target_ratio = width / height
                if clip_ratio == target_ratio:
                    clip = clip.resized(new_size=(width, height))
                else:
                    scale = width / clip_w if clip_ratio > target_ratio else height / clip_h
                    resized = clip.resized(
                        new_size=(int(clip_w * scale), int(clip_h * scale))
                    ).with_position("center")
                    background = ColorClip(size=(width, height), color=(0, 0, 0)).with_duration(
                        clip.duration
                    )
                    clip = CompositeVideoClip([background, resized])
            clips.append(clip)
        combined = concatenate_videoclips(clips, method="compose")
        codec = video._get_configured_video_codec()
        video._write_videofile_with_codec_fallback(
            combined, output_file=out_path, codec=codec,
            audio=False, threads=threads, logger=None,
        )
        combined.close()
    finally:
        for clip in clips:
            video.close_clip(clip)


class MoviePyTimelineRenderer:
    name = "moviepy"

    def __init__(self, store: ProjectStore | None = None) -> None:
        self._store = store

    def _resolve_render_inputs(self, project: TimelineProject) -> RenderInputs:
        inputs = RenderInputs()
        for track in project.tracks:
            if track.type == "video":
                inputs.video_items.extend(track.items)
            elif track.type == "audio" and track.items and track.id == "music_1":
                inputs.music_path = track.items[0].local_path
                inputs.music_volume = track.items[0].volume
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

    def render(
        self, project: TimelineProject, spec: RenderSpec, output_dir: str
    ) -> RenderResult:
        os.makedirs(output_dir, exist_ok=True)
        inputs = self._resolve_render_inputs(project)
        params = self._build_video_params(project, spec)
        if spec.include_background_music and inputs.music_path:
            params.bgm_file = inputs.music_path
            params.bgm_type = ""
            if inputs.music_volume is not None:
                params.bgm_volume = inputs.music_volume
        width, height = params.video_aspect.to_resolution()
        combined_path = os.path.join(output_dir, "combined.mp4")
        output_file = os.path.join(output_dir, "final.mp4")
        try:
            _concat_timeline_clips(
                inputs.video_items, width, height, combined_path,
                threads=params.n_threads or 2,
            )
            video.generate_video(
                video_path=combined_path,
                audio_path=inputs.narration_path or "",
                subtitle_path=inputs.subtitle_path or "",
                output_file=output_file,
                params=params,
            )
        except Exception as exc:  # noqa: BLE001 - report render failure, do not crash caller
            result = RenderResult(
                project_id=project.project_id, output_path=output_file,
                renderer_used=self.name, success=False, error=str(exc),
            )
            self._persist(project, result, inputs, spec, ok=False)
            return result

        size = os.path.getsize(output_file) if os.path.exists(output_file) else None
        result = RenderResult(
            project_id=project.project_id, output_path=output_file,
            duration_sec=inputs.total_duration_sec, file_size_bytes=size,
            renderer_used=self.name, success=True,
        )
        self._persist(project, result, inputs, spec, ok=True)
        return result

    def _persist(
        self, project: TimelineProject, result: RenderResult,
        inputs: RenderInputs, spec: RenderSpec, ok: bool,
    ) -> None:
        if self._store is None or not project.task_id:
            return
        manifest = RenderManifest(
            project_id=project.project_id, task_id=project.task_id, renderer=self.name,
            output_path=result.output_path, video_item_count=len(inputs.video_items),
            total_duration_sec=inputs.total_duration_sec,
            has_audio=inputs.narration_path is not None,
            has_subtitles=inputs.subtitle_path is not None and spec.include_subtitles,
            background_music=spec.include_background_music,
            warnings=[] if ok else [result.error or "render failed"],
        )
        self._store.save_render_manifest(project.task_id, manifest)
        self._store.save_render_result(project.task_id, result)
