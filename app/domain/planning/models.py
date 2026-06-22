from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, model_validator


class MusicIntent(BaseModel):
    mood: str
    energy: str
    tempo: str | None = None
    style: str | None = None
    avoid: list[str] = []
    commercial_use_required: bool = False


class ShotSegment(BaseModel):
    id: str
    order: int
    narration_text: str
    start_sec: float | None = None
    end_sec: float | None = None
    target_duration_sec: float
    visual_goal: str
    search_queries: list[str]
    fallback_queries: list[str] = []
    preferred_providers: list[str] = []
    must_avoid: list[str] = []
    mood: str | None = None
    pacing: str | None = None

    @model_validator(mode="after")
    def _queries_not_empty(self) -> "ShotSegment":
        if not self.search_queries:
            raise ValueError("search_queries must contain at least one query")
        return self


class ShotPlan(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    task_id: str | None = None
    language: str
    topic: str | None = None
    script: str
    total_duration_sec: float | None = None
    segments: list[ShotSegment]
    global_visual_style: str | None = None
    music_intent: MusicIntent | None = None

    @model_validator(mode="after")
    def _segments_present_and_ordered(self) -> "ShotPlan":
        if not self.segments:
            raise ValueError("ShotPlan requires at least one segment")
        orders = [s.order for s in self.segments]
        if orders != sorted(orders):
            raise ValueError("segments must be sorted by .order")
        return self
