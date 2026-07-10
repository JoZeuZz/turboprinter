from __future__ import annotations

import json
import os

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.controllers.v1 import publications as pc
from app.domain.operational.models import ProjectRun
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(pc.config, "project_mode_enabled", True)
    monkeypatch.setattr(pc.config, "publication_enabled", True)
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    monkeypatch.setattr(pc, "FilesystemProjectStore", lambda: store)
    return TestClient(app), store, tmp_path


def _rendered_project(store: FilesystemProjectStore, tmp_path, project_id="project-1"):
    store.save_script(project_id, "Guion de prueba.")
    store.save_project_metadata(project_id, topic="Tema", workspace_id="ws-1")
    output_path = os.path.join(str(tmp_path), project_id, "final.mp4")
    store.save_render_result(
        project_id,
        type("RenderResultLike", (), {
            "model_dump_json": lambda self, indent=2: json.dumps({
                "project_id": project_id,
                "output_path": output_path,
                "renderer_used": "moviepy",
                "success": True,
                "error": None,
            }, indent=indent)
        })(),
    )
    ProjectRunRepository().create(
        **ProjectRun(project_id=project_id, task_id=project_id, source="test", workspace_id="ws-1").model_dump()
    )


def test_create_draft_endpoint(client):
    c, store, tmp_path = client
    _rendered_project(store, tmp_path)

    r = c.post(
        "/api/v1/projects/project-1/publication/draft",
        json={"title": "Manual", "description": "Desc", "tags": ["a"]},
    )

    assert r.status_code == 200
    pub = r.json()["data"]["publication"]
    assert pub["title"] == "Manual"
    assert pub["status"] == "draft"
    assert pub["dry_run"] is True


def test_create_draft_requires_render(client):
    c, store, _tmp_path = client
    store.save_script("project-1", "Guion.")
    ProjectRunRepository().create(
        **ProjectRun(project_id="project-1", task_id="project-1", source="test").model_dump()
    )

    r = c.post("/api/v1/projects/project-1/publication/draft", json={"title": "Manual"})

    assert r.status_code == 400


@pytest.mark.parametrize("thumbnail_path", ["/tmp/thumbnail.jpg", "../thumbnail.jpg"])
def test_create_draft_rejects_unsafe_thumbnail_path(client, thumbnail_path):
    c, store, tmp_path = client
    _rendered_project(store, tmp_path)

    r = c.post(
        "/api/v1/projects/project-1/publication/draft",
        json={"title": "Manual", "thumbnail_path": thumbnail_path},
    )

    assert r.status_code == 400
    assert "thumbnail_path" in r.text


def test_publish_dry_run_endpoint_updates_publication(client):
    c, store, tmp_path = client
    _rendered_project(store, tmp_path)
    draft = c.post("/api/v1/projects/project-1/publication/draft", json={"title": "Manual"}).json()["data"]["publication"]

    r = c.post(f"/api/v1/publications/{draft['id']}/publish", json={"dry_run": True})

    assert r.status_code == 200
    pub = r.json()["data"]["publication"]
    assert pub["status"] == "published"
    assert pub["external_video_id"] == f"dry-run:{draft['id']}"


def test_publish_endpoint_allows_omitted_body_and_uses_default_dry_run(client):
    c, store, tmp_path = client
    _rendered_project(store, tmp_path)
    draft = c.post("/api/v1/projects/project-1/publication/draft", json={"title": "Manual"}).json()["data"]["publication"]

    r = c.post(f"/api/v1/publications/{draft['id']}/publish")

    assert r.status_code == 200
    pub = r.json()["data"]["publication"]
    assert pub["status"] == "published"
    assert pub["dry_run"] is True


def test_list_and_get_publications(client):
    c, store, tmp_path = client
    _rendered_project(store, tmp_path)
    draft = c.post("/api/v1/projects/project-1/publication/draft", json={"title": "Manual"}).json()["data"]["publication"]

    listed = c.get("/api/v1/publications", params={"project_id": "project-1"})
    fetched = c.get(f"/api/v1/publications/{draft['id']}")

    assert listed.status_code == 200
    assert listed.json()["data"]["publications"][0]["id"] == draft["id"]
    assert fetched.status_code == 200
    assert fetched.json()["data"]["publication"]["id"] == draft["id"]


def test_publication_endpoints_404_when_disabled(monkeypatch):
    monkeypatch.setattr(pc.config, "project_mode_enabled", True)
    monkeypatch.setattr(pc.config, "publication_enabled", False)
    c = TestClient(app)

    assert c.get("/api/v1/publications").status_code == 404


def test_publication_endpoints_404_when_project_mode_disabled(client, monkeypatch):
    c, store, tmp_path = client
    _rendered_project(store, tmp_path)
    draft = c.post("/api/v1/projects/project-1/publication/draft", json={"title": "Manual"}).json()["data"]["publication"]
    monkeypatch.setattr(pc.config, "project_mode_enabled", False)

    assert c.post("/api/v1/projects/project-1/publication/draft", json={"title": "Manual"}).status_code == 404
    assert c.post(f"/api/v1/publications/{draft['id']}/publish", json={"dry_run": True}).status_code == 404
    assert c.get("/api/v1/publications", params={"project_id": "project-1"}).status_code == 404
    assert c.get(f"/api/v1/publications/{draft['id']}").status_code == 404
