from __future__ import annotations

import json
from unittest.mock import MagicMock

import pytest

from app.domain.operational.models import Job
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.workers import handlers


@pytest.fixture
def store(tmp_path):
    return FilesystemProjectStore(base_tasks_dir=str(tmp_path))


def _job(project_id: str, payload: dict) -> Job:
    return Job(type="full_project_pipeline", project_id=project_id, payload_json=json.dumps(payload))


def _wire_happy_path(monkeypatch, store, preflight_result):
    fake_plan = MagicMock()
    monkeypatch.setattr(handlers, "ShotPlanner", lambda *a, **k: MagicMock(plan=lambda **kw: fake_plan))
    monkeypatch.setattr(store, "load_shot_plan", lambda pid: fake_plan)
    monkeypatch.setattr(
        handlers, "MediaAggregator", lambda *a, **k: MagicMock(select_for_plan=lambda *a, **k: {})
    )
    monkeypatch.setattr(
        handlers.legacy_task, "generate_audio", lambda *a, **k: ("/tmp/audio.mp3", 5.0, MagicMock())
    )
    monkeypatch.setattr(handlers.legacy_task, "generate_subtitle", lambda *a, **k: "/tmp/subs.srt")
    monkeypatch.setattr(
        handlers, "TimelineBuilder", lambda *a, **k: MagicMock(build_from_store=lambda *a, **k: None)
    )
    monkeypatch.setattr(
        handlers, "ProjectPreflightService",
        lambda *a, **k: MagicMock(run=lambda pid: preflight_result),
    )


def test_full_pipeline_happy_path(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)
    store.save_script("proj-1", "Uno. Dos. Tres.")
    store.save_project_metadata("proj-1", topic="cats", workspace_id=None)

    preflight_ok = MagicMock(valid=True, warnings=[], errors=[])
    _wire_happy_path(monkeypatch, store, preflight_ok)
    render_ok = MagicMock(success=True, error=None)
    monkeypatch.setattr(handlers, "render_project_from_store", lambda *a, **k: render_ok)

    handlers.handle_full_project_pipeline(_job("proj-1", {"language": "es"}))


def test_full_pipeline_raises_when_no_script(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)

    with pytest.raises(ValueError, match="has no script"):
        handlers.handle_full_project_pipeline(_job("proj-missing", {"language": "es"}))


def test_full_pipeline_fails_on_invalid_preflight(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)
    store.save_script("proj-2", "Uno.")

    preflight_bad = MagicMock(valid=False, warnings=[], errors=["no video track"])
    _wire_happy_path(monkeypatch, store, preflight_bad)

    with pytest.raises(RuntimeError, match="no video track"):
        handlers.handle_full_project_pipeline(_job("proj-2", {"language": "es"}))


def test_full_pipeline_fails_on_render_failure(monkeypatch, store):
    monkeypatch.setattr(handlers, "_store", lambda: store)
    store.save_script("proj-3", "Uno.")

    preflight_ok = MagicMock(valid=True, warnings=[], errors=[])
    _wire_happy_path(monkeypatch, store, preflight_ok)
    render_bad = MagicMock(success=False, error="ffmpeg exploded")
    monkeypatch.setattr(handlers, "render_project_from_store", lambda *a, **k: render_bad)

    with pytest.raises(RuntimeError, match="ffmpeg exploded"):
        handlers.handle_full_project_pipeline(_job("proj-3", {"language": "es"}))
