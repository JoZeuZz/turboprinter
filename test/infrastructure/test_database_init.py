from __future__ import annotations

from sqlalchemy import inspect

from app.config import config
from app.infrastructure.database import engine as db_engine


def test_get_engine_creates_sqlite_file_and_runs_migrations():
    eng = db_engine.get_engine()

    assert eng is not None
    inspector = inspect(eng)
    assert "project_runs" in inspector.get_table_names()


def test_get_engine_is_memoized():
    first = db_engine.get_engine()
    second = db_engine.get_engine()

    assert first is second


def test_get_engine_returns_none_when_database_disabled(monkeypatch):
    monkeypatch.setattr(config, "database_enabled", False)
    db_engine.reset_engine_for_tests()

    assert db_engine.get_engine() is None
