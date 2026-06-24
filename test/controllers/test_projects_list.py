"""Tests for GET /api/v1/projects list endpoint."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.config import config as app_config
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@pytest.fixture
def project_store_dir(tmp_path, monkeypatch):
    """Create fake project directories with timeline_project.json files and wire the store."""
    for proj_id, topic in [("proj-aaa", "Morning exercise"), ("proj-bbb", "Reddit AITA")]:
        proj_dir = tmp_path / proj_id
        proj_dir.mkdir()
        timeline = {"project_id": proj_id, "title": topic, "tracks": []}
        (proj_dir / "timeline_project.json").write_text(json.dumps(timeline))

    # Enable project mode
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)

    # Point FilesystemProjectStore._base_dir to tmp_path
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_base_dir",
        lambda self: str(tmp_path),
        raising=False,
    )
    return tmp_path


def test_list_projects_returns_list(project_store_dir):
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "projects" in data
    assert isinstance(data["projects"], list)


def test_list_projects_includes_topic(project_store_dir):
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    topics = [p["topic"] for p in resp.json()["data"]["projects"]]
    assert "Morning exercise" in topics or "Reddit AITA" in topics


def test_list_projects_returns_both_projects(project_store_dir):
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    projects = resp.json()["data"]["projects"]
    project_ids = {p["project_id"] for p in projects}
    assert "proj-aaa" in project_ids
    assert "proj-bbb" in project_ids


def test_list_projects_skips_dirs_without_timeline(project_store_dir):
    """Directories without timeline_project.json must be silently skipped."""
    # Add a dir without the expected file
    no_timeline = project_store_dir / "no-timeline-proj"
    no_timeline.mkdir()
    (no_timeline / "some_other_file.txt").write_text("x")

    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    assert resp.status_code == 200
    project_ids = {p["project_id"] for p in resp.json()["data"]["projects"]}
    assert "no-timeline-proj" not in project_ids


def test_list_projects_empty_dir(tmp_path, monkeypatch):
    """Empty base directory returns empty list."""
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_base_dir",
        lambda self: str(tmp_path),
        raising=False,
    )
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    assert resp.status_code == 200
    assert resp.json()["data"]["projects"] == []


def test_list_projects_skips_corrupt_json(project_store_dir):
    """Corrupt timeline_project.json must be silently skipped, not crash."""
    corrupt_dir = project_store_dir / "corrupt-proj"
    corrupt_dir.mkdir()
    (corrupt_dir / "timeline_project.json").write_text("{ not valid json }")

    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    assert resp.status_code == 200
    project_ids = {p["project_id"] for p in resp.json()["data"]["projects"]}
    assert "corrupt-proj" not in project_ids


def test_list_projects_has_updated_at(project_store_dir):
    """Each project entry must include an updated_at ISO timestamp."""
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    for project in resp.json()["data"]["projects"]:
        assert "updated_at" in project
        # Must be an ISO 8601 string
        assert "T" in project["updated_at"]


def test_list_projects_project_mode_disabled(monkeypatch):
    """When project mode is disabled, endpoint returns 404."""
    monkeypatch.setattr(app_config, "project_mode_enabled", False, raising=False)
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    assert resp.status_code == 404
