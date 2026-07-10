from __future__ import annotations

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    MetaData,
    String,
    Table,
    Text,
)

metadata = MetaData()

schema_migrations = Table(
    "schema_migrations",
    metadata,
    Column("version", Integer, primary_key=True),
    Column("name", String, nullable=False),
    Column("applied_at", DateTime, nullable=False),
)

workspaces = Table(
    "workspaces",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    Column("metadata_json", Text, nullable=True),
)

prompt_templates = Table(
    "prompt_templates",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("workspace_id", String, nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
    Column("metadata_json", Text, nullable=True),
)

prompt_versions = Table(
    "prompt_versions",
    metadata,
    Column("id", String, primary_key=True),
    Column("template_id", String, ForeignKey("prompt_templates.id"), nullable=False),
    Column("version", Integer, nullable=False),
    Column("system_prompt", Text, nullable=True),
    Column("user_prompt", Text, nullable=True),
    Column("model_hint", String, nullable=True),
    Column("created_at", DateTime, nullable=False),
)

project_runs = Table(
    "project_runs",
    metadata,
    Column("id", String, primary_key=True),
    Column("project_id", String, nullable=False, unique=True),
    Column("task_id", String, nullable=False),
    Column("workspace_id", String, nullable=True),
    Column("source", String, nullable=False),
    Column("topic", String, nullable=True),
    Column("status", String, nullable=False, server_default="created"),
    Column("prompt_template_id", String, nullable=True),
    Column("prompt_version_id", String, nullable=True),
    Column("provider", String, nullable=True),
    Column("model", String, nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)

video_outputs = Table(
    "video_outputs",
    metadata,
    Column("id", String, primary_key=True),
    Column("project_run_id", String, ForeignKey("project_runs.id"), nullable=False),
    Column("file_path", String, nullable=False),
    Column("duration_sec", Float, nullable=True),
    Column("width", Integer, nullable=True),
    Column("height", Integer, nullable=True),
    Column("codec", String, nullable=True),
    Column("created_at", DateTime, nullable=False),
)

publications = Table(
    "publications",
    metadata,
    Column("id", String, primary_key=True),
    Column("video_output_id", String, ForeignKey("video_outputs.id"), nullable=False),
    Column("project_id", String, nullable=True),
    Column("workspace_id", String, nullable=True),
    Column("platform", String, nullable=False),
    Column("channel_id", String, nullable=True),
    Column("external_id", String, nullable=True),
    Column("external_video_id", String, nullable=True),
    Column("title", Text, nullable=True),
    Column("description", Text, nullable=True),
    Column("tags_json", Text, nullable=True),
    Column("thumbnail_path", String, nullable=True),
    Column("privacy_status", String, nullable=False, server_default="private"),
    Column("scheduled_at", DateTime, nullable=True),
    Column("published_at", DateTime, nullable=True),
    Column("status", String, nullable=False, server_default="pending"),
    Column("error", Text, nullable=True),
    Column("dry_run", Boolean, nullable=False, server_default="1"),
    Column("metadata_json", Text, nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=True),
)

metrics_snapshots = Table(
    "metrics_snapshots",
    metadata,
    Column("id", String, primary_key=True),
    Column("publication_id", String, ForeignKey("publications.id"), nullable=False),
    Column("captured_at", DateTime, nullable=False),
    Column("views", Integer, nullable=True),
    Column("likes", Integer, nullable=True),
    Column("comments", Integer, nullable=True),
    Column("shares", Integer, nullable=True),
    Column("raw_json", Text, nullable=True),
)

experiments = Table(
    "experiments",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("hypothesis", Text, nullable=True),
    Column("status", String, nullable=False, server_default="draft"),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)

experiment_variants = Table(
    "experiment_variants",
    metadata,
    Column("id", String, primary_key=True),
    Column("experiment_id", String, ForeignKey("experiments.id"), nullable=False),
    Column("name", String, nullable=False),
    Column("config_json", Text, nullable=True),
    Column("created_at", DateTime, nullable=False),
)

decision_rules = Table(
    "decision_rules",
    metadata,
    Column("id", String, primary_key=True),
    Column("name", String, nullable=False),
    Column("condition_json", Text, nullable=False),
    Column("action_json", Text, nullable=False),
    Column("enabled", Boolean, nullable=False, server_default="1"),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)

decision_events = Table(
    "decision_events",
    metadata,
    Column("id", String, primary_key=True),
    Column("decision_rule_id", String, ForeignKey("decision_rules.id"), nullable=True),
    Column("context_json", Text, nullable=True),
    Column("outcome", String, nullable=True),
    Column("created_at", DateTime, nullable=False),
)

jobs = Table(
    "jobs",
    metadata,
    Column("id", String, primary_key=True),
    Column("type", String, nullable=False),
    Column("status", String, nullable=False, server_default="pending"),
    Column("workspace_id", String, nullable=True),
    Column("project_id", String, nullable=True),
    Column("payload_json", Text, nullable=False, server_default="{}"),
    Column("scheduled_at", DateTime, nullable=False),
    Column("started_at", DateTime, nullable=True),
    Column("completed_at", DateTime, nullable=True),
    Column("attempts", Integer, nullable=False, server_default="0"),
    Column("max_attempts", Integer, nullable=False, server_default="3"),
    Column("last_error", Text, nullable=True),
    Column("created_at", DateTime, nullable=False),
    Column("updated_at", DateTime, nullable=False),
)

ALL_TABLES = (
    schema_migrations,
    workspaces,
    prompt_templates,
    prompt_versions,
    project_runs,
    video_outputs,
    publications,
    metrics_snapshots,
    experiments,
    experiment_variants,
    decision_rules,
    decision_events,
    jobs,
)
