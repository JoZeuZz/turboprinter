from __future__ import annotations

from typing import Union

from pydantic import BaseModel, Field

from app.domain.media.models import MediaCandidate


class MoveClipCommand(BaseModel):
    track_id: str
    item_id: str
    new_start_sec: float = Field(ge=0.0)


class TrimClipCommand(BaseModel):
    track_id: str
    item_id: str
    trim_start_sec: float = Field(default=0.0, ge=0.0)
    trim_end_sec: float | None = None


class ReplaceClipCommand(BaseModel):
    track_id: str
    item_id: str
    new_candidate: MediaCandidate


class SetClipTimingCommand(BaseModel):
    track_id: str
    item_id: str
    duration_sec: float = Field(gt=0.0)


class SetClipVolumeCommand(BaseModel):
    track_id: str
    item_id: str
    volume: float = Field(ge=0.0, le=2.0)


EditCommand = Union[
    MoveClipCommand,
    TrimClipCommand,
    ReplaceClipCommand,
    SetClipTimingCommand,
    SetClipVolumeCommand,
]
