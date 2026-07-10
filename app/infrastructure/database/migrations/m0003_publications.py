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
    schema.publications.create(connection, checkfirst=True)
    existing = _columns(connection, "publications")
    _add(connection, existing, "publications", "project_id", "VARCHAR")
    _add(connection, existing, "publications", "workspace_id", "VARCHAR")
    _add(connection, existing, "publications", "channel_id", "VARCHAR")
    _add(connection, existing, "publications", "external_video_id", "VARCHAR")
    _add(connection, existing, "publications", "title", "TEXT")
    _add(connection, existing, "publications", "description", "TEXT")
    _add(connection, existing, "publications", "tags_json", "TEXT")
    _add(connection, existing, "publications", "thumbnail_path", "VARCHAR")
    _add(connection, existing, "publications", "privacy_status", "VARCHAR DEFAULT 'private'")
    _add(connection, existing, "publications", "scheduled_at", "DATETIME")
    _add(connection, existing, "publications", "error", "TEXT")
    _add(connection, existing, "publications", "dry_run", "BOOLEAN DEFAULT 1")
    _add(connection, existing, "publications", "updated_at", "DATETIME")
    connection.execute(
        text("UPDATE publications SET external_video_id = external_id WHERE external_video_id IS NULL AND external_id IS NOT NULL")
    )
