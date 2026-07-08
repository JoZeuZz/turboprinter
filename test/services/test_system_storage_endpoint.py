from __future__ import annotations

from fastapi.testclient import TestClient

from app.asgi import app


def test_storage_status_reports_database_initialized():
    client = TestClient(app)

    r = client.get("/api/v1/system/storage")

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["database"]["initialized"] is True
    assert data["database"]["backend"] == "sqlite"
    assert data["database"]["tables"] == 13
    assert data["database"]["schema_version"] == 2
    assert "storage_dir" in data["filesystem"]


def test_storage_status_reports_disabled_database(monkeypatch):
    from app.config import config

    monkeypatch.setattr(config, "database_enabled", False)
    client = TestClient(app)

    r = client.get("/api/v1/system/storage")

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["database"]["initialized"] is False
    assert "error" in data["database"]


def test_storage_status_reports_genuine_database_error(monkeypatch):
    from app.controllers.v1 import system as system_module

    def _boom():
        raise RuntimeError("connection exploded")

    monkeypatch.setattr(system_module.db_engine, "get_engine", _boom)
    client = TestClient(app)

    r = client.get("/api/v1/system/storage")

    assert r.status_code == 200
    data = r.json()["data"]
    assert data["database"]["initialized"] is False
    assert "connection exploded" in data["database"]["error"]
