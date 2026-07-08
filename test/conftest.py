from __future__ import annotations

import pytest


@pytest.fixture(autouse=True)
def _isolated_database(tmp_path, monkeypatch):
    """Every test gets its own sqlite file and a fresh engine singleton, so
    no test can write to the real storage/app.db in the repo checkout."""
    from app.config import config
    from app.infrastructure.database import engine as db_engine

    monkeypatch.setattr(config, "database_sqlite_path", str(tmp_path / "test_app.db"))
    db_engine.reset_engine_for_tests()
    yield
    db_engine.reset_engine_for_tests()
