from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class ManualMetricsRequest(BaseModel):
    age_window: str
    platform: str | None = None
    external_video_id: str | None = None
    collected_at: datetime | None = None
    views: int | None = Field(default=None, ge=0)
    impressions: int | None = Field(default=None, ge=0)
    ctr: float | None = Field(default=None, ge=0)
    average_view_duration: float | None = Field(default=None, ge=0)
    average_view_percentage: float | None = Field(default=None, ge=0)
    likes: int | None = Field(default=None, ge=0)
    comments: int | None = Field(default=None, ge=0)
    subscribers_gained: int | None = Field(default=None, ge=0)
    estimated_revenue: float | None = Field(default=None, ge=0)
    rpm: float | None = Field(default=None, ge=0)
    metadata: dict = Field(default_factory=dict)
