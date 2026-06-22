from __future__ import annotations

from collections.abc import Mapping, Sequence

from app.config import config
from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan, ShotSegment
from app.domain.projects.models import ExportSettings, TimelineItem, TimelineProject, TimelineTrack
from app.domain.projects.validators import validate_no_gaps, validate_no_overlaps
from app.infrastructure.storage.base import ProjectStore

SelectedMedia = Mapping[str, MediaCandidate] | Sequence[MediaCandidate]

DURATION_EPSILON_SEC = 1e-6


class TimelineBuilder:
    def __init__(self, store: ProjectStore | None = None) -> None:
        self._store = store

    @staticmethod
    def _duration(segment: ShotSegment) -> float:
        if segment.start_sec is not None and segment.end_sec is not None:
            duration = segment.end_sec - segment.start_sec
            if duration > 0:
                return duration
        return segment.target_duration_sec

    @staticmethod
    def _selection_by_segment(selected_media: SelectedMedia) -> dict[str, MediaCandidate]:
        if isinstance(selected_media, Mapping):
            return dict(selected_media)
        by_segment: dict[str, MediaCandidate] = {}
        for candidate in selected_media:
            if candidate.segment_id:
                by_segment[candidate.segment_id] = candidate
        return by_segment

    @staticmethod
    def _candidate_path(candidate: MediaCandidate) -> str | None:
        return candidate.local_path or candidate.download_url or candidate.source_url

    def build(
        self,
        shot_plan: ShotPlan,
        selected_media: SelectedMedia,
        task_id: str | None = None,
        title: str | None = None,
        export: ExportSettings | None = None,
        narration_audio_path: str | None = None,
        subtitle_path: str | None = None,
    ) -> TimelineProject:
        project_task_id = task_id or shot_plan.task_id
        selection = self._selection_by_segment(selected_media)
        items: list[TimelineItem] = []
        missing_segments: list[str] = []
        repeated_media_segments: list[dict[str, float | int | str]] = []
        invalid_media_segments: list[dict[str, float | str]] = []
        cursor = 0.0

        for segment in shot_plan.segments:
            duration = self._duration(segment)
            if duration <= 0:
                raise ValueError(f"segment {segment.id!r} has non-positive duration")
            candidate = selection.get(segment.id)
            if candidate is None:
                missing_segments.append(segment.id)
                items.append(TimelineItem(
                    id=f"item_{segment.id}", media_id=None, local_path=None,
                    start_sec=cursor, duration_sec=duration, segment_id=segment.id,
                    provider="placeholder",
                ))
            elif (
                candidate.duration_sec is not None
                and candidate.duration_sec <= DURATION_EPSILON_SEC
            ):
                invalid_media_segments.append({
                    "segment_id": segment.id,
                    "media_id": candidate.id,
                    "duration_sec": candidate.duration_sec,
                })
                items.append(TimelineItem(
                    id=f"item_{segment.id}", media_id=None, local_path=None,
                    start_sec=cursor, duration_sec=duration, segment_id=segment.id,
                    provider="placeholder",
                ))
            elif (
                candidate.duration_sec is not None
                and DURATION_EPSILON_SEC < candidate.duration_sec < duration - DURATION_EPSILON_SEC
            ):
                source_duration = candidate.duration_sec
                remaining = duration
                part_start = cursor
                parts = 0
                while remaining > DURATION_EPSILON_SEC:
                    part_duration = min(source_duration, remaining)
                    parts += 1
                    items.append(TimelineItem(
                        id=f"item_{segment.id}_{parts}", media_id=candidate.id,
                        local_path=self._candidate_path(candidate), start_sec=part_start,
                        duration_sec=part_duration, trim_start_sec=0.0,
                        trim_end_sec=part_duration,
                        segment_id=segment.id, provider=candidate.provider,
                    ))
                    part_start += part_duration
                    remaining -= part_duration
                repeated_media_segments.append({
                    "segment_id": segment.id,
                    "media_id": candidate.id,
                    "source_duration_sec": source_duration,
                    "target_duration_sec": duration,
                    "parts": parts,
                })
            else:
                items.append(TimelineItem(
                    id=f"item_{segment.id}", media_id=candidate.id,
                    local_path=self._candidate_path(candidate), start_sec=cursor,
                    duration_sec=duration, trim_start_sec=0.0,
                    trim_end_sec=min(candidate.duration_sec, duration)
                    if candidate.duration_sec is not None else None,
                    segment_id=segment.id, provider=candidate.provider,
                ))
            cursor += duration

        video_track = TimelineTrack(id="video_1", type="video", name="Video", items=items)
        validate_no_gaps(video_track)
        validate_no_overlaps(video_track)
        tracks = [video_track]
        if narration_audio_path:
            tracks.append(TimelineTrack(
                id="audio_1",
                type="audio",
                name="Audio",
                items=[TimelineItem(
                    id="item_audio_1",
                    local_path=narration_audio_path,
                    start_sec=0.0,
                    duration_sec=cursor,
                )],
            ))
        if subtitle_path:
            tracks.append(TimelineTrack(
                id="subtitle_1",
                type="subtitle",
                name="Subtitle",
                items=[TimelineItem(
                    id="item_subtitle_1",
                    local_path=subtitle_path,
                    start_sec=0.0,
                    duration_sec=cursor,
                )],
            ))
        project_kwargs = {
            "task_id": project_task_id,
            "title": title,
            "script": shot_plan.script,
            "shot_plan": shot_plan,
            "tracks": tracks,
            "export": export or ExportSettings(),
            "metadata": {
                "timeline_builder_version": "1.0",
                "timeline_duration_sec": cursor,
                "missing_media_segments": missing_segments,
                "repeated_media_segments": repeated_media_segments,
                "invalid_media_segments": invalid_media_segments,
                "selected_media_count": len(selection),
            },
        }
        if project_task_id:
            project_kwargs["project_id"] = project_task_id
        project = TimelineProject(**project_kwargs)
        if self._store is not None and project_task_id:
            self._store.save_timeline(project_task_id, project)
        return project

    def build_from_store(
        self,
        task_id: str,
        title: str | None = None,
        export: ExportSettings | None = None,
        narration_audio_path: str | None = None,
        subtitle_path: str | None = None,
    ) -> TimelineProject:
        if self._store is None:
            raise ValueError("ProjectStore is required to build a timeline from store")
        shot_plan = self._store.load_shot_plan(task_id)
        if shot_plan is None:
            raise ValueError(f"shot_plan.json not found for task {task_id!r}")
        return self.build(
            shot_plan,
            self._store.load_selected_media(task_id),
            task_id=task_id,
            title=title,
            export=export,
            narration_audio_path=narration_audio_path,
            subtitle_path=subtitle_path,
        )


def get_timeline_builder(store: ProjectStore | None = None) -> TimelineBuilder | None:
    if not getattr(config, "project_mode_enabled", False):
        return None
    return TimelineBuilder(store=store)
