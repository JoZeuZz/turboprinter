from __future__ import annotations

from pydantic import BaseModel, Field

from app.domain.media.models import LicenseInfo


class MusicTrack(BaseModel):
    id: str
    provider: str
    local_path: str | None = None
    url: str | None = None
    title: str | None = None
    tags: list[str] = Field(default_factory=list)
    duration_sec: float | None = None
    license: LicenseInfo | None = None
    volume: float | None = None
    score: float | None = None
    score_reasons: list[str] = Field(default_factory=list)
