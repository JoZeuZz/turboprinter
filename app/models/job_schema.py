from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

JobType = Literal[
    "generate_project",
    "plan_project",
    "search_media",
    "synthesize_narration",
    "build_timeline",
    "render_project",
    "full_project_pipeline",
]

JOB_TYPES: frozenset[str] = frozenset(
    {
        "generate_project",
        "plan_project",
        "search_media",
        "synthesize_narration",
        "build_timeline",
        "render_project",
        "full_project_pipeline",
    }
)


class JobCreateRequest(BaseModel):
    type: str
    workspace_id: str | None = None
    project_id: str | None = None
    payload: dict = {}
    scheduled_at: datetime | None = None
    max_attempts: int = 3


class RunFullPipelineRequest(BaseModel):
    project_id: str | None = None
    topic: str | None = None
    script: str | None = None
    language: str = "es"
    voice_name: str = ""
    voice_rate: float = 1.0
    subtitle_enabled: bool = True
    visual_style: str | None = None
    orientation: str | None = None
    allow_preflight_warnings: bool = False
    scheduled_at: datetime | None = None
