from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import Engine, select

from app.infrastructure.database import schema
from app.infrastructure.database.migrations import m0001_initial, m0002_jobs, m0003_publications, m0004_metrics

MIGRATIONS: tuple[tuple[int, str, object], ...] = (
    (1, "initial", m0001_initial.upgrade),
    (2, "jobs", m0002_jobs.upgrade),
    (3, "publications", m0003_publications.upgrade),
    (4, "metrics", m0004_metrics.upgrade),
)


def _ensure_schema_migrations(connection) -> None:
    schema.schema_migrations.create(connection, checkfirst=True)


def _applied_versions(connection) -> set[int]:
    rows = connection.execute(select(schema.schema_migrations.c.version)).fetchall()
    return {row[0] for row in rows}


def apply_pending(engine: Engine) -> None:
    with engine.begin() as connection:
        _ensure_schema_migrations(connection)
        applied = _applied_versions(connection)
        for version, name, upgrade in MIGRATIONS:
            if version in applied:
                continue
            upgrade(connection)
            connection.execute(
                schema.schema_migrations.insert().values(
                    version=version, name=name, applied_at=datetime.now(timezone.utc)
                )
            )
