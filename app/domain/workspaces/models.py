from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Workspace(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: str | None = None
    platform: str | None = None
    channel_ref: str | None = None
    language: str = "es"
    target_format: str | None = None
    default_voice: str | None = None
    voice_rate: float = 1.0
    subtitle_style: str | None = None
    visual_style: str | None = None
    music_profile: str | None = None
    prompt_template_id: str | None = None
    upload_schedule: str | None = None
    enabled: bool = True
    safety_rules: dict[str, Any] = Field(default_factory=dict)
    monetization_policy: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)
