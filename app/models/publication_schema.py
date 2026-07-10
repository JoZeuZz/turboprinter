from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class DraftPublicationRequest(BaseModel):
    platform: str | None = None
    channel_id: str | None = None
    title: str | None = None
    description: str | None = None
    tags: list[str] = Field(default_factory=list)
    thumbnail_path: str | None = None
    privacy_status: str | None = None
    scheduled_at: datetime | None = None
    dry_run: bool | None = None


class PublishPublicationRequest(BaseModel):
    dry_run: bool | None = None
