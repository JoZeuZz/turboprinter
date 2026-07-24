from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.controllers.v1 import jobs as jc
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(jc.config, "jobs_enabled", True)
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    monkeypatch.setattr(jc, "FilesystemProjectStore", lambda: store)
    return TestClient(app), store


def test_endpoints_404_when_jobs_disabled(monkeypatch):
    monkeypatch.setattr(jc.config, "jobs_enabled", False)
    c = TestClient(app)
    assert c.get("/api/v1/jobs").status_code == 404
    assert c.post("/api/v1/jobs", json={"type": "render_project"}).status_code == 404
    assert (
        c.post("/api/v1/workspaces/ws-1/run-full-pipeline", json={"language": "es"}).status_code
        == 404
    )


def test_create_job_rejects_unknown_type(client):
    c, _store = client
    r = c.post("/api/v1/jobs", json={"type": "not-a-real-type"})
    assert r.status_code == 400


def test_create_and_get_job(client):
    c, _store = client
    r = c.post(
        "/api/v1/jobs",
        json={"type": "render_project", "project_id": "p1", "payload": {"foo": "bar"}},
    )
    assert r.status_code == 200
    job = r.json()["data"]["job"]
    assert job["status"] == "pending"
    assert job["payload"] == {"foo": "bar"}
    assert job["project_id"] == "p1"

    g = c.get(f"/api/v1/jobs/{job['id']}")
    assert g.status_code == 200
    assert g.json()["data"]["job"]["id"] == job["id"]


def test_create_publish_video_job(client):
    c, _store = client
    r = c.post(
        "/api/v1/jobs",
        json={"type": "publish_video", "project_id": "p1", "payload": {"publication_id": "pub-1", "dry_run": True}},
    )

    assert r.status_code == 200
    job = r.json()["data"]["job"]
    assert job["type"] == "publish_video"
    assert job["payload"] == {"publication_id": "pub-1", "dry_run": True}


def test_get_missing_job_404(client):
    c, _store = client
    assert c.get("/api/v1/jobs/does-not-exist").status_code == 404


def test_list_jobs_filters_by_type(client):
    c, _store = client
    c.post("/api/v1/jobs", json={"type": "render_project", "project_id": "p1"})
    c.post("/api/v1/jobs", json={"type": "plan_project", "project_id": "p2"})

    r = c.get("/api/v1/jobs", params={"type": "render_project"})
    assert r.status_code == 200
    jobs = r.json()["data"]["jobs"]
    assert len(jobs) == 1
    assert jobs[0]["type"] == "render_project"


def test_cancel_pending_job(client):
    c, _store = client
    job_id = c.post("/api/v1/jobs", json={"type": "render_project"}).json()["data"]["job"]["id"]

    r = c.post(f"/api/v1/jobs/{job_id}/cancel")

    assert r.status_code == 200
    assert r.json()["data"]["job"]["status"] == "cancelled"


def test_cancel_missing_job_404(client):
    c, _store = client
    assert c.post("/api/v1/jobs/does-not-exist/cancel").status_code == 404


def test_run_full_pipeline_creates_project_and_enqueues_job(client, monkeypatch):
    c, _store = client
    monkeypatch.setattr(jc.llm, "generate_script", lambda **kw: "Guion generado.")
    r = c.post(
        "/api/v1/workspaces/ws-1/run-full-pipeline",
        json={"topic": "cats", "language": "es"},
    )
    assert r.status_code == 200
    body = r.json()["data"]
    assert body["job_id"]
    assert body["project_id"]

    job = c.get(f"/api/v1/jobs/{body['job_id']}").json()["data"]["job"]
    assert job["type"] == "full_project_pipeline"
    assert job["project_id"] == body["project_id"]
    assert job["workspace_id"] == "ws-1"


def test_run_full_pipeline_generates_script_from_topic(client, monkeypatch):
    c, store = client
    monkeypatch.setattr(jc.llm, "generate_script", lambda **kw: "Guion fijo de prueba.")
    r = c.post(
        "/api/v1/workspaces/ws-1/run-full-pipeline",
        json={"topic": "cats", "language": "es"},
    )
    assert r.status_code == 200
    project_id = r.json()["data"]["project_id"]
    assert store.load_script(project_id) == "Guion fijo de prueba."


def test_run_full_pipeline_registers_project_run_for_new_project(client, monkeypatch):
    c, _store = client
    monkeypatch.setattr(jc.llm, "generate_script", lambda **kw: "Guion generado.")
    r = c.post(
        "/api/v1/workspaces/ws-1/run-full-pipeline",
        json={"topic": "cats", "language": "es"},
    )
    assert r.status_code == 200
    project_id = r.json()["data"]["project_id"]

    from app.infrastructure.database.repositories.project_runs import ProjectRunRepository

    run = ProjectRunRepository().get_by_project_id(project_id)
    assert run is not None
    assert run.source == "pipeline"
    assert run.topic == "cats"


def test_run_full_pipeline_with_existing_project_id_does_not_duplicate_run(client, monkeypatch):
    c, store = client
    monkeypatch.setattr(jc.llm, "generate_script", lambda **kw: "Guion generado.")
    created = c.post(
        "/api/v1/workspaces/ws-1/run-full-pipeline",
        json={"topic": "cats", "language": "es"},
    )
    project_id = created.json()["data"]["project_id"]

    from app.infrastructure.database.repositories.project_runs import ProjectRunRepository

    repo = ProjectRunRepository()
    count_before = len(repo.list(project_id=project_id))
    assert count_before == 1

    r = c.post(
        "/api/v1/workspaces/ws-1/run-full-pipeline",
        json={"project_id": project_id, "language": "es"},
    )
    assert r.status_code == 200

    count_after = len(repo.list(project_id=project_id))
    assert count_after == count_before


def test_run_full_pipeline_requires_project_id_or_topic_or_script(client):
    c, _store = client
    r = c.post("/api/v1/workspaces/ws-1/run-full-pipeline", json={"language": "es"})
    assert r.status_code == 400


def test_run_full_pipeline_404s_on_missing_project_id(client):
    c, _store = client
    r = c.post(
        "/api/v1/workspaces/ws-1/run-full-pipeline",
        json={"project_id": "does-not-exist", "language": "es"},
    )
    assert r.status_code == 404


def test_create_collect_metrics_job(client):
    c, _store = client
    r = c.post(
        "/api/v1/jobs",
        json={"type": "collect_metrics", "workspace_id": "ws-1", "payload": {"provider": "stub"}},
    )

    assert r.status_code == 200
    job = r.json()["data"]["job"]
    assert job["type"] == "collect_metrics"
