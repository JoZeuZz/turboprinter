from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, model_validator

from app.domain.planning.models import ShotPlan
from app.domain.projects.commands import (
    EditCommand,
    MoveClipCommand,
    ReplaceClipCommand,
    SetClipTimingCommand,
    SetClipVolumeCommand,
    TrimClipCommand,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimelineItem(BaseModel):
    id: str
    media_id: str | None = None
    local_path: str | None = None
    start_sec: float
    duration_sec: float
    trim_start_sec: float = 0.0
    trim_end_sec: float | None = None
    segment_id: str | None = None
    provider: str | None = None
    transition_in: str | None = None
    transition_out: str | None = None
    volume: float | None = None


class TimelineTrack(BaseModel):
    id: str
    type: Literal["video", "audio", "subtitle", "overlay"]
    name: str
    items: list[TimelineItem]

    @model_validator(mode="after")
    def _items_sorted_by_start(self) -> "TimelineTrack":
        starts = [i.start_sec for i in self.items]
        if starts != sorted(starts):
            raise ValueError("track items must be sorted by start_sec")
        return self


class ExportSettings(BaseModel):
    width: int = 1080
    height: int = 1920
    fps: int = 30
    codec: str = "libx264"
    audio_codec: str = "aac"


class TimelineProject(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    project_id: str = Field(default_factory=lambda: str(uuid4()))
    task_id: str | None = None
    title: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    script: str | None = None
    shot_plan: ShotPlan | None = None
    tracks: list[TimelineTrack] = []
    export: ExportSettings = Field(default_factory=ExportSettings)
    metadata: dict[str, Any] = {}

    def _find_item(self, track_id: str, item_id: str) -> TimelineItem:
        for track in self.tracks:
            if track.id != track_id:
                continue
            for item in track.items:
                if item.id == item_id:
                    return item
            raise KeyError(f"item {item_id!r} not found in track {track_id!r}")
        raise KeyError(f"track {track_id!r} not found")

    def apply(self, command: EditCommand) -> None:
        item = self._find_item(command.track_id, command.item_id)
        if isinstance(command, MoveClipCommand):
            item.start_sec = command.new_start_sec
        elif isinstance(command, TrimClipCommand):
            item.trim_start_sec = command.trim_start_sec
            item.trim_end_sec = command.trim_end_sec
        elif isinstance(command, ReplaceClipCommand):
            cand = command.new_candidate
            item.media_id = cand.id
            item.local_path = cand.local_path
            item.provider = cand.provider
        elif isinstance(command, SetClipTimingCommand):
            item.duration_sec = command.duration_sec
        elif isinstance(command, SetClipVolumeCommand):
            item.volume = command.volume
        else:  # pragma: no cover - exhaustive guard
            raise TypeError(f"unsupported command: {type(command).__name__}")
        self.updated_at = _utcnow()
