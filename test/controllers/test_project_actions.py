"""Tests for project rename/delete/duplicate endpoints."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.config import config as app_config
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@pytest.fixture
def project_dir(tmp_path, monkeypatch):
    proj = tmp_path / "proj-aaa"
    proj.mkdir()
    (proj / "project.json").write_text(
        json.dumps({"project_id": "proj-aaa", "topic": "Tema origen"})
    )
    (proj / "render_spec.json").write_text(json.dumps({"voice": "es-1"}))
    (proj / "script.txt").write_text("guion")
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore, "_base_dir", lambda self: str(tmp_path), raising=False
    )
    # Route the store's task dir to tmp_path as well
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_task_dir",
        lambda self, task_id, make=False: _make_dir(str(tmp_path), task_id, make),
        raising=False,
    )
    return tmp_path


def _make_dir(base, task_id, make):
    import os

    path = os.path.join(base, task_id)
    if make:
        os.makedirs(path, exist_ok=True)
    return path


def test_delete_project(project_dir):
    client = TestClient(app)
    resp = client.delete("/api/v1/projects/proj-aaa")
    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True
    assert not (project_dir / "proj-aaa").exists()


def test_delete_missing_returns_404(project_dir):
    client = TestClient(app)
    resp = client.delete("/api/v1/projects/nope")
    assert resp.status_code == 404


def test_rename_updates_topic(project_dir):
    client = TestClient(app)
    resp = client.patch("/api/v1/projects/proj-aaa/metadata", json={"topic": "Nuevo"})
    assert resp.status_code == 200
    assert resp.json()["data"]["topic"] == "Nuevo"
    meta = json.loads((project_dir / "proj-aaa" / "project.json").read_text())
    assert meta["topic"] == "Nuevo"


def test_rename_empty_topic_returns_400(project_dir):
    client = TestClient(app)
    resp = client.patch("/api/v1/projects/proj-aaa/metadata", json={"topic": "  "})
    assert resp.status_code == 400


def test_duplicate_creates_new_project(project_dir):
    client = TestClient(app)
    resp = client.post("/api/v1/projects/proj-aaa/duplicate")
    assert resp.status_code == 200
    new_id = resp.json()["data"]["project_id"]
    assert new_id != "proj-aaa"
    assert (project_dir / new_id / "render_spec.json").exists()
    assert not (project_dir / new_id / "script.txt").exists()


def test_duplicate_missing_returns_404(project_dir):
    client = TestClient(app)
    resp = client.post("/api/v1/projects/nope/duplicate")
    assert resp.status_code == 404
