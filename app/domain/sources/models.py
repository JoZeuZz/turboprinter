from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class StorySource(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    id: str
    kind: Literal["reddit", "manual"] = "reddit"
    url: str | None = None
    subreddit: str | None = None
    title: str | None = None
    body: str = ""
    comments: list[str] = Field(default_factory=list)
    author_anonymized: bool = True
    fetched_at: datetime = Field(default_factory=_utcnow)
    metadata: dict[str, Any] = Field(default_factory=dict)
    license_note: str | None = None
