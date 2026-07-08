from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PromptTemplate(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    content_type: str
    language: str = "es"
    system_prompt: str
    user_prompt_template: str
    expected_schema: dict[str, Any] | None = None
    active_version_id: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)


class PromptVersion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    template_id: str
    version: int
    system_prompt: str
    user_prompt_template: str
    expected_schema: dict[str, Any] | None = None
    model_hint: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    change_notes: str | None = None
    active: bool = False
