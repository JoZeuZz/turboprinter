from __future__ import annotations

import os

from sqlalchemy import inspect

from app.config import config
from app.controllers.v1.base import new_router
from app.infrastructure.database import engine as db_engine, schema
from app.models.project_schema import BaseProjectResponse
from app.utils import utils

router = new_router()


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


def _database_status() -> dict:
    if not getattr(config, "database_enabled", True):
        return {
            "backend": config.database_backend,
            "path": config.database_sqlite_path,
            "initialized": False,
            "error": "database disabled ([database].enabled = false)",
        }
    try:
        engine = db_engine.get_engine()
        if engine is None:
            return {
                "backend": config.database_backend,
                "path": config.database_sqlite_path,
                "initialized": False,
                "error": "engine unavailable",
            }
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        with engine.connect() as connection:
            row = connection.execute(
                schema.schema_migrations.select()
                .order_by(schema.schema_migrations.c.version.desc())
                .limit(1)
            ).fetchone()
        schema_version = row.version if row is not None else 0
        return {
            "backend": config.database_backend,
            "path": config.database_sqlite_path,
            "initialized": True,
            "schema_version": schema_version,
            "tables": len(table_names),
        }
    except Exception as exc:
        return {
            "backend": config.database_backend,
            "path": config.database_sqlite_path,
            "initialized": False,
            "error": str(exc),
        }


def _filesystem_status() -> dict:
    storage_dir = utils.storage_dir()
    return {"storage_dir": storage_dir, "exists": os.path.isdir(storage_dir)}


@router.get("/system/storage", summary="Database and filesystem storage status")
def get_storage_status():
    return _ok({"database": _database_status(), "filesystem": _filesystem_status()})
