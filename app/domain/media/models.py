from __future__ import annotations

from pydantic import BaseModel


class LicenseInfo(BaseModel):
    type: str | None = None
    commercial_use: bool | None = None
    attribution_required: bool | None = None
    source_url: str | None = None
    license_name: str | None = None
    license_url: str | None = None
    usage_notes: str | None = None
    source_terms_url: str | None = None
    training_restricted: bool | None = None
    redistribution_restricted: bool | None = None
    unknown_or_provider_specific: bool = False


class MediaCandidate(BaseModel):
    id: str
    provider: str
    source_url: str | None = None
    download_url: str | None = None
    local_path: str | None = None
    thumbnail_url: str | None = None
    width: int | None = None
    height: int | None = None
    duration_sec: float | None = None
    fps: float | None = None
    query: str | None = None
    title: str | None = None
    tags: list[str] = []
    license: LicenseInfo | None = None
    score: float | None = None
    score_reasons: list[str] = []
    segment_id: str | None = None
