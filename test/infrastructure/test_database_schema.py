from __future__ import annotations

from app.infrastructure.database import schema


def test_schema_has_all_expected_tables():
    expected = {
        "schema_migrations",
        "workspaces",
        "prompt_templates",
        "prompt_versions",
        "project_runs",
        "video_outputs",
        "publications",
        "metrics_snapshots",
        "experiments",
        "experiment_variants",
        "decision_rules",
        "decision_events",
        "jobs",
    }
    assert set(schema.metadata.tables.keys()) == expected
    assert len(schema.ALL_TABLES) == 13


def test_project_runs_table_has_expected_columns():
    columns = {c.name for c in schema.project_runs.columns}
    assert columns == {
        "id", "project_id", "task_id", "workspace_id", "source", "topic",
        "status", "prompt_template_id", "prompt_version_id", "provider",
        "model", "created_at", "updated_at",
    }


def test_jobs_table_has_expected_columns():
    columns = {c.name for c in schema.jobs.columns}
    assert columns == {
        "id", "type", "status", "workspace_id", "project_id", "payload_json",
        "scheduled_at", "started_at", "completed_at", "attempts",
        "max_attempts", "last_error", "created_at", "updated_at",
    }
