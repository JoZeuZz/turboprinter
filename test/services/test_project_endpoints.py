from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.controllers.v1 import projects as pj


@pytest.fixture
def client(monkeypatch, tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    monkeypatch.setattr(pj.config, "project_mode_enabled", True)
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    monkeypatch.setattr(pj, "_store", lambda: store)
    return TestClient(app)


def test_endpoints_404_when_project_mode_off(monkeypatch):
    monkeypatch.setattr(pj.config, "project_mode_enabled", False)
    c = TestClient(app)
    r = c.post("/api/v1/projects/from-script", json={"script": "Hola.", "language": "es"})
    assert r.status_code == 404


def test_create_from_script_and_get(client):
    r = client.post(
        "/api/v1/projects/from-script",
        json={"script": "Uno. Dos.", "language": "es", "topic": "demo"},
    )
    assert r.status_code == 200
    project_id = r.json()["data"]["project_id"]
    assert project_id

    g = client.get(f"/api/v1/projects/{project_id}")
    assert g.status_code == 200
    data = g.json()["data"]
    assert data["project_id"] == project_id
    assert data["has_script"] is True
    assert data["has_shot_plan"] is False


def test_create_from_topic_generates_script(client, monkeypatch):
    monkeypatch.setattr(pj.llm, "generate_script", lambda **kw: "Guion generado.")
    r = client.post(
        "/api/v1/projects/from-topic",
        json={"topic": "gatos", "language": "es", "generate_script": True},
    )
    assert r.status_code == 200
    project_id = r.json()["data"]["project_id"]
    g = client.get(f"/api/v1/projects/{project_id}")
    assert g.json()["data"]["has_script"] is True


def test_get_unknown_project_404(client):
    assert client.get("/api/v1/projects/ghost").status_code == 404
