from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.domain.publication.models import Publication
from app.domain.operational.models import Job
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.workers import handlers


@pytest.fixture
def store(tmp_path):
    return FilesystemProjectStore(base_tasks_dir=str(tmp_path))


def _job(job_type: str, project_id: str | None, payload: dict) -> Job:
    return Job(type=job_type, project_id=project_id, payload_json=json.dumps(payload))


def test_handle_generate_project_creates_project(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)

    handlers.handle_generate_project(_job("generate_project", None, {"topic": "cats", "script": "Uno."}))

    projects = store.list_projects(limit=10)
    assert len(projects) == 1


def test_handle_plan_project_calls_shot_planner(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)
    store.save_script("proj-1", "Uno. Dos.")
    fake_planner = MagicMock()
    monkeypatch.setattr(handlers, "ShotPlanner", lambda *a, **k: fake_planner)

    handlers.handle_plan_project(_job("plan_project", "proj-1", {"language": "es"}))

    fake_planner.plan.assert_called_once()
    call_kwargs = fake_planner.plan.call_args.kwargs
    assert call_kwargs["script"] == "Uno. Dos."
    assert call_kwargs["task_id"] == "proj-1"


def test_handle_plan_project_raises_when_no_script(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)

    with pytest.raises(ValueError, match="has no script"):
        handlers.handle_plan_project(_job("plan_project", "proj-empty", {"language": "es"}))


def test_handle_search_media_raises_when_no_plan(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)

    with pytest.raises(ValueError, match="has no shot plan"):
        handlers.handle_search_media(_job("search_media", "proj-1", {}))


def test_handle_synthesize_narration_raises_on_missing_audio(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)
    store.save_script("proj-1", "Uno.")
    monkeypatch.setattr(
        handlers.legacy_task, "generate_audio", lambda *a, **k: (None, 0.0, None)
    )

    with pytest.raises(RuntimeError, match="narration synthesis failed"):
        handlers.handle_synthesize_narration(_job("synthesize_narration", "proj-1", {}))


def test_handle_render_project_raises_when_no_timeline(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)

    with pytest.raises(ValueError, match="has no timeline"):
        handlers.handle_render_project(_job("render_project", "proj-1", {}))


def test_handle_publish_video_calls_publication_service(monkeypatch):
    calls = []

    class FakePublicationService:
        def publish(self, publication_id, dry_run=None):
            calls.append((publication_id, dry_run))
            return Publication(
                id=publication_id,
                video_output_id="vo-1",
                title="Title",
                status="published",
            )

    monkeypatch.setattr(handlers, "PublicationService", FakePublicationService)

    handlers.handle_publish_video(_job("publish_video", "proj-1", {"publication_id": "pub-1", "dry_run": True}))

    assert calls == [("pub-1", True)]


def test_handle_publish_video_raises_when_publication_failed(monkeypatch):
    class FakePublicationService:
        def publish(self, publication_id, dry_run=None):
            return Publication(
                id=publication_id,
                video_output_id="vo-1",
                title="Title",
                status="failed",
                error="youtube publisher disabled",
            )

    monkeypatch.setattr(handlers, "PublicationService", FakePublicationService)

    with pytest.raises(RuntimeError, match="youtube publisher disabled"):
        handlers.handle_publish_video(_job("publish_video", "proj-1", {"publication_id": "pub-1", "dry_run": False}))


def test_handle_publish_video_requires_publication_id():
    with pytest.raises(ValueError, match="publication_id"):
        handlers.handle_publish_video(_job("publish_video", "proj-1", {}))
