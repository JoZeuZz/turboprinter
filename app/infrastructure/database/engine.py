from __future__ import annotations

import os
import threading

from sqlalchemy import Engine, create_engine, event

_engine: Engine | None = None
_lock = threading.Lock()


def _resolve_sqlite_path(sqlite_path: str) -> str:
    if os.path.isabs(sqlite_path):
        return sqlite_path
    from app.utils import utils

    return os.path.join(utils.root_dir(), sqlite_path)


def _build_engine(sqlite_path: str) -> Engine:
    resolved = _resolve_sqlite_path(sqlite_path)
    parent = os.path.dirname(resolved)
    if parent and not os.path.exists(parent):
        os.makedirs(parent)
    engine = create_engine(f"sqlite:///{resolved}", future=True)

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()

    return engine


def get_engine() -> Engine | None:
    global _engine
    from app.config import config

    if not getattr(config, "database_enabled", True):
        return None
    with _lock:
        if _engine is None:
            from app.infrastructure.database.migrations.runner import apply_pending

            engine = _build_engine(config.database_sqlite_path)
            apply_pending(engine)
            _engine = engine
        return _engine


def reset_engine_for_tests() -> None:
    global _engine
    with _lock:
        if _engine is not None:
            _engine.dispose()
        _engine = None
