from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.config import config as app_config
from app.infrastructure.storage.workspace_store import WorkspaceStore


@pytest.fixture
def workspaces_enabled(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "workspaces_enabled", True, raising=False)
    monkeypatch.setattr(WorkspaceStore, "_dir", lambda self, make=False: str(tmp_path), raising=False)
    return tmp_path


def test_workspaces_404_when_disabled():
    client = TestClient(app)
    assert client.get("/api/v1/workspaces").status_code == 404
    assert client.post("/api/v1/workspaces", json={"name": "x"}).status_code == 404


def test_create_requires_name(workspaces_enabled):
    client = TestClient(app)
    resp = client.post("/api/v1/workspaces", json={"name": "  "})
    assert resp.status_code == 400


def test_create_and_get(workspaces_enabled):
    client = TestClient(app)
    created = client.post("/api/v1/workspaces", json={
        "name": "Canal Curiosidades", "language": "es", "target_format": "shorts",
    })
    assert created.status_code == 200
    workspace_id = created.json()["data"]["workspace"]["id"]

    got = client.get(f"/api/v1/workspaces/{workspace_id}")
    assert got.status_code == 200
    assert got.json()["data"]["workspace"]["name"] == "Canal Curiosidades"
    assert got.json()["data"]["workspace"]["target_format"] == "shorts"


def test_get_unknown_404(workspaces_enabled):
    client = TestClient(app)
    assert client.get("/api/v1/workspaces/ghost").status_code == 404


def test_list_returns_created_workspaces(workspaces_enabled):
    client = TestClient(app)
    client.post("/api/v1/workspaces", json={"name": "A"})
    client.post("/api/v1/workspaces", json={"name": "B"})
    resp = client.get("/api/v1/workspaces")
    assert resp.status_code == 200
    names = {w["name"] for w in resp.json()["data"]["workspaces"]}
    assert names == {"A", "B"}


def test_update_replaces_fields_and_keeps_id(workspaces_enabled):
    client = TestClient(app)
    created = client.post("/api/v1/workspaces", json={"name": "Original"})
    workspace_id = created.json()["data"]["workspace"]["id"]
    created_at = created.json()["data"]["workspace"]["created_at"]

    updated = client.put(f"/api/v1/workspaces/{workspace_id}", json={
        "name": "Renamed", "language": "en",
    })
    assert updated.status_code == 200
    body = updated.json()["data"]["workspace"]
    assert body["id"] == workspace_id
    assert body["name"] == "Renamed"
    assert body["language"] == "en"
    assert body["created_at"] == created_at


def test_update_unknown_404(workspaces_enabled):
    client = TestClient(app)
    resp = client.put("/api/v1/workspaces/ghost", json={"name": "x"})
    assert resp.status_code == 404


def test_delete_existing_and_missing(workspaces_enabled):
    client = TestClient(app)
    created = client.post("/api/v1/workspaces", json={"name": "To Delete"})
    workspace_id = created.json()["data"]["workspace"]["id"]

    deleted = client.delete(f"/api/v1/workspaces/{workspace_id}")
    assert deleted.status_code == 200
    assert deleted.json()["data"]["deleted"] is True

    assert client.get(f"/api/v1/workspaces/{workspace_id}").status_code == 404
    assert client.delete(f"/api/v1/workspaces/{workspace_id}").status_code == 404
