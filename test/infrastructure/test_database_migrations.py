from __future__ import annotations

from sqlalchemy import create_engine, inspect

from app.infrastructure.database import schema
from app.infrastructure.database.migrations.runner import apply_pending


def test_apply_pending_creates_all_tables(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'migrations.db'}")

    apply_pending(engine)

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    assert table_names == set(schema.metadata.tables.keys())


def test_apply_pending_is_idempotent(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'migrations.db'}")

    apply_pending(engine)
    apply_pending(engine)

    with engine.connect() as connection:
        rows = connection.execute(schema.schema_migrations.select()).fetchall()
    assert {row.version for row in rows} == {1, 2}


def test_apply_pending_applies_jobs_migration(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'migrations2.db'}")

    apply_pending(engine)

    inspector = inspect(engine)
    assert "jobs" in inspector.get_table_names()
