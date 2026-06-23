from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RenderSpec(BaseModel):
    project_id: str
    task_id: str | None = None
    renderer: Literal["moviepy", "opencut"] = "moviepy"
    output_format: Literal["mp4"] = "mp4"
    width: int = Field(gt=0)
    height: int = Field(gt=0)
    fps: int = Field(ge=1, le=120)
    codec: str = "libx264"
    audio_codec: str = "aac"
    include_subtitles: bool = True
    include_background_music: bool = True
    subtitle_style: str | None = None
    font_name: str | None = None


class RenderResult(BaseModel):
    project_id: str
    output_path: str
    duration_sec: float | None = None
    file_size_bytes: int | None = None
    renderer_used: str
    success: bool
    error: str | None = None
    completed_at: datetime = Field(default_factory=_utcnow)


class RenderManifest(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    project_id: str
    task_id: str | None = None
    renderer: str
    output_path: str
    video_item_count: int = 0
    total_duration_sec: float | None = None
    has_audio: bool = False
    has_subtitles: bool = False
    background_music: bool = False
    warnings: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=_utcnow)
