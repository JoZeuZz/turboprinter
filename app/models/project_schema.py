from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.domain.projects.commands import EditCommand


class BaseProjectResponse(BaseModel):
    status: int = 200
    message: str = "success"
    data: Any = None


class CreateFromTopicRequest(BaseModel):
    topic: str
    language: str = "es"
    generate_script: bool = False
    paragraph_number: int = 1
    global_visual_style: str | None = None
    target_duration_sec: float | None = None


class CreateFromScriptRequest(BaseModel):
    script: str
    language: str = "es"
    topic: str | None = None
    global_visual_style: str | None = None
    target_duration_sec: float | None = None


class CreateFromRedditRequest(BaseModel):
    url: str | None = None
    title: str | None = None
    body: str | None = None
    comments: list[str] = []
    language: str = "es"
    topic: str | None = None


class PlanRequest(BaseModel):
    target_duration_sec: float | None = None
    global_visual_style: str | None = None


class MediaSearchRequest(BaseModel):
    orientation: str | None = None
    prefer_local: bool = False


class TimelineBuildRequest(BaseModel):
    title: str | None = None
    narration_audio_path: str | None = None
    subtitle_path: str | None = None


class TimelineCommandsRequest(BaseModel):
    commands: list[EditCommand]


class MusicSelectRequest(BaseModel):
    mood: str | None = None
    energy: str | None = None
    tempo: str | None = None
    style: str | None = None
    avoid: list[str] = Field(default_factory=list)
    commercial_safe_only: bool = True
    local_only: bool = True
    volume: float = Field(default=0.2, ge=0.0, le=2.0)


class RenderRequest(BaseModel):
    renderer: Literal["moviepy", "opencut"] | None = None
    include_subtitles: bool = True
    include_background_music: bool = True
