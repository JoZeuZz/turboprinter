from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol
from uuid import uuid4

from pydantic import BaseModel, Field

PUBLICATION_STATUSES: frozenset[str] = frozenset({"draft", "publishing", "published", "failed"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Publication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    video_output_id: str
    project_id: str | None = None
    workspace_id: str | None = None
    platform: str = "youtube"
    channel_id: str | None = None
    external_video_id: str | None = None
    title: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    thumbnail_path: str | None = None
    privacy_status: str = "private"
    scheduled_at: datetime | None = None
    published_at: datetime | None = None
    status: str = "draft"
    error: str | None = None
    dry_run: bool = True
    metadata: dict = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class PublicationRequest(BaseModel):
    publication_id: str
    video_path: str
    platform: str
    channel_id: str | None = None
    title: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    thumbnail_path: str | None = None
    privacy_status: str = "private"
    scheduled_at: datetime | None = None
    dry_run: bool = True
    metadata: dict = Field(default_factory=dict)


class PublicationResult(BaseModel):
    success: bool
    external_video_id: str | None = None
    published_at: datetime | None = None
    error: str | None = None
    metadata: dict = Field(default_factory=dict)


class Publisher(Protocol):
    def publish(self, publication_request: PublicationRequest) -> PublicationResult:
        ...
