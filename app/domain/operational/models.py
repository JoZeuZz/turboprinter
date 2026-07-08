from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ProjectRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    project_id: str
    task_id: str
    workspace_id: str | None = None
    source: str
    topic: str | None = None
    status: str = "created"
    prompt_template_id: str | None = None
    prompt_version_id: str | None = None
    provider: str | None = None
    model: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class VideoOutput(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    project_run_id: str
    file_path: str
    duration_sec: float | None = None
    width: int | None = None
    height: int | None = None
    codec: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)


class Publication(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    video_output_id: str
    platform: str
    external_id: str | None = None
    status: str = "pending"
    published_at: datetime | None = None
    metadata_json: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)


class MetricsSnapshot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    publication_id: str
    captured_at: datetime = Field(default_factory=_utcnow)
    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    shares: int | None = None
    raw_json: str | None = None


class Experiment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    hypothesis: str | None = None
    status: str = "draft"
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class ExperimentVariant(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    experiment_id: str
    name: str
    config_json: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)


class DecisionRule(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    condition_json: str
    action_json: str
    enabled: bool = True
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


class DecisionEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    decision_rule_id: str | None = None
    context_json: str | None = None
    outcome: str | None = None
    created_at: datetime = Field(default_factory=_utcnow)
