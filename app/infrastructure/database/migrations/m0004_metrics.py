from __future__ import annotations

from sqlalchemy import Connection, text

from app.infrastructure.database import schema


def _columns(connection: Connection, table: str) -> set[str]:
    rows = connection.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return {row[1] for row in rows}


def _add(connection: Connection, existing: set[str], table: str, name: str, ddl: str) -> None:
    if name not in existing:
        connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
        existing.add(name)


def upgrade(connection: Connection) -> None:
    schema.metrics_snapshots.create(connection, checkfirst=True)
    existing = _columns(connection, "metrics_snapshots")
    _add(connection, existing, "metrics_snapshots", "external_video_id", "VARCHAR")
    _add(connection, existing, "metrics_snapshots", "platform", "VARCHAR DEFAULT 'youtube'")
    _add(connection, existing, "metrics_snapshots", "collected_at", "DATETIME")
    _add(connection, existing, "metrics_snapshots", "age_window", "VARCHAR")
    _add(connection, existing, "metrics_snapshots", "impressions", "INTEGER")
    _add(connection, existing, "metrics_snapshots", "ctr", "FLOAT")
    _add(connection, existing, "metrics_snapshots", "average_view_duration", "FLOAT")
    _add(connection, existing, "metrics_snapshots", "average_view_percentage", "FLOAT")
    _add(connection, existing, "metrics_snapshots", "subscribers_gained", "INTEGER")
    _add(connection, existing, "metrics_snapshots", "estimated_revenue", "FLOAT")
    _add(connection, existing, "metrics_snapshots", "rpm", "FLOAT")
    _add(connection, existing, "metrics_snapshots", "metadata_json", "TEXT")
    connection.execute(
        text("UPDATE metrics_snapshots SET collected_at = captured_at WHERE collected_at IS NULL AND captured_at IS NOT NULL")
    )
    connection.execute(
        text("UPDATE metrics_snapshots SET metadata_json = raw_json WHERE metadata_json IS NULL AND raw_json IS NOT NULL")
    )
    connection.execute(
        text("CREATE INDEX IF NOT EXISTS ix_metrics_publication_platform_window ON metrics_snapshots(publication_id, platform, age_window)")
    )
