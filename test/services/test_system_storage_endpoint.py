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
    assert data["database"]["tables"] == 12
    assert data["database"]["schema_version"] == 1
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
