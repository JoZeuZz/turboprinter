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


def test_plan_endpoint_runs_shot_planner(client, monkeypatch):
    from app.domain.planning.models import ShotPlan, ShotSegment

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno. Dos.", "language": "es"}
    ).json()["data"]["project_id"]

    class FakePlanner:
        def plan(self, script, language, target_duration_sec=None, topic=None,
                 visual_style=None, task_id=None):
            plan = ShotPlan(
                task_id=task_id, language=language, script=script,
                segments=[ShotSegment(
                    id="seg_001", order=1, narration_text="Uno.",
                    target_duration_sec=3.0, visual_goal="x", search_queries=["q"],
                )],
            )
            pj._store().save_shot_plan(task_id, plan)
            return plan

    monkeypatch.setattr(pj, "_shot_planner", lambda store: FakePlanner())
    r = client.post(f"/api/v1/projects/{pid}/plan", json={})
    assert r.status_code == 200
    assert r.json()["data"]["segment_count"] == 1
    assert pj._store().load_shot_plan(pid) is not None


def test_plan_endpoint_requires_script(client):
    pid = client.post(
        "/api/v1/projects/from-topic", json={"topic": "x", "language": "es"}
    ).json()["data"]["project_id"]
    # from-topic without generate_script writes an empty script
    assert client.post(f"/api/v1/projects/{pid}/plan", json={}).status_code == 400


def test_media_search_endpoint(client, monkeypatch):
    from app.domain.media.models import MediaCandidate
    from app.domain.planning.models import ShotPlan, ShotSegment

    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    plan = ShotPlan(
        task_id=pid, language="es", script="Uno.",
        segments=[ShotSegment(id="seg_001", order=1, narration_text="Uno.",
                              target_duration_sec=3.0, visual_goal="x", search_queries=["q"])],
    )
    pj._store().save_shot_plan(pid, plan)

    class FakeAgg:
        def select_for_plan(self, shot_plan, orientation=None, prefer_local=False, task_id=None):
            sel = {"seg_001": MediaCandidate(id="mc-1", provider="pexels", segment_id="seg_001")}
            pj._store().save_selected_media(task_id, list(sel.values()))
            return sel

    monkeypatch.setattr(pj, "_media_aggregator", lambda store: FakeAgg())
    r = client.post(f"/api/v1/projects/{pid}/media/search", json={})
    assert r.status_code == 200
    assert r.json()["data"]["selected_count"] == 1


def test_media_search_requires_shot_plan(client):
    pid = client.post(
        "/api/v1/projects/from-script", json={"script": "Uno.", "language": "es"}
    ).json()["data"]["project_id"]
    assert client.post(f"/api/v1/projects/{pid}/media/search", json={}).status_code == 400
