from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.config import config as app_config
from app.domain.operational.models import ProjectRun
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.database.repositories.video_outputs import VideoOutputRepository


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(app_config, "publication_enabled", True, raising=False)
    return TestClient(app)


def _publication(project_id="project-1", workspace_id="ws-1", metadata=None):
    run = ProjectRunRepository().create(
        **ProjectRun(project_id=project_id, task_id=project_id, source="test", workspace_id=workspace_id).model_dump()
    )
    video = VideoOutputRepository().get_or_create_for_render(run.id, f"/tmp/{project_id}.mp4")
    return PublicationRepository().create(
        video_output_id=video.id,
        project_id=project_id,
        workspace_id=workspace_id,
        platform="youtube",
        external_video_id=f"yt-{project_id}",
        title="Title",
        description="Description",
        status="published",
        metadata=metadata or {},
    )


def test_post_and_get_publication_metrics(client):
    publication = _publication()

    created = client.post(f"/api/v1/publications/{publication.id}/metrics", json={"age_window": "24h", "views": 100})
    listed = client.get(f"/api/v1/publications/{publication.id}/metrics")

    assert created.status_code == 200
    assert created.json()["data"]["metrics_snapshot"]["views"] == 100
    assert listed.status_code == 200
    assert listed.json()["data"]["metrics"][0]["age_window"] == "24h"


def test_post_metrics_rejects_unknown_publication(client):
    r = client.post("/api/v1/publications/missing/metrics", json={"age_window": "24h", "views": 100})
    assert r.status_code == 404


def test_workspace_metrics_summary(client):
    publication = _publication(metadata={"voice": "voice-a"})
    client.post(f"/api/v1/publications/{publication.id}/metrics", json={"age_window": "24h", "views": 100})

    r = client.get("/api/v1/workspaces/ws-1/metrics/summary")

    assert r.status_code == 200
    body = r.json()["data"]
    assert body["totals"]["views"] == 100
    assert body["groups"]["voice"][0]["key"] == "voice-a"


def test_project_metrics(client):
    publication = _publication(project_id="project-x")
    client.post(f"/api/v1/publications/{publication.id}/metrics", json={"age_window": "2h", "views": 50})

    r = client.get("/api/v1/projects/project-x/metrics")

    assert r.status_code == 200
    assert r.json()["data"]["project_id"] == "project-x"
    assert r.json()["data"]["metrics"][0]["views"] == 50
