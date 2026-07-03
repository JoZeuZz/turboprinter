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


from app.domain.projects.models import TimelineItem, TimelineProject, TimelineTrack


def test_get_project_exposes_asset_url_for_local_clip(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_task_dir",
        lambda self, task_id, make=False: _make_dir(str(tmp_path), task_id, make),
        raising=False,
    )
    store = FilesystemProjectStore()
    store.save_script("proj-clip", "guion")
    project_dir = tmp_path / "proj-clip"
    project_dir.mkdir(exist_ok=True)
    (project_dir / "clip.mp4").write_bytes(b"fake-video")
    project = TimelineProject(
        project_id="proj-clip", task_id="proj-clip",
        tracks=[TimelineTrack(id="video_1", type="video", name="Video", items=[
            TimelineItem(id="item_1", local_path="clip.mp4", start_sec=0.0, duration_sec=3.0),
        ])],
    )
    store.save_timeline("proj-clip", project)

    client = TestClient(app)
    resp = client.get("/api/v1/projects/proj-clip")

    assert resp.status_code == 200
    item = resp.json()["data"]["timeline"]["tracks"][0]["items"][0]
    assert item["asset_url"] == "/api/v1/projects/proj-clip/assets/clip.mp4"


def test_get_project_asset_url_passthrough_for_remote_candidate(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_task_dir",
        lambda self, task_id, make=False: _make_dir(str(tmp_path), task_id, make),
        raising=False,
    )
    store = FilesystemProjectStore()
    store.save_script("proj-remote", "guion")
    project = TimelineProject(
        project_id="proj-remote", task_id="proj-remote",
        tracks=[TimelineTrack(id="video_1", type="video", name="Video", items=[
            TimelineItem(
                id="item_1", local_path="https://cdn.example.com/clip.mp4",
                start_sec=0.0, duration_sec=3.0,
            ),
        ])],
    )
    store.save_timeline("proj-remote", project)

    client = TestClient(app)
    resp = client.get("/api/v1/projects/proj-remote")

    item = resp.json()["data"]["timeline"]["tracks"][0]["items"][0]
    assert item["asset_url"] == "https://cdn.example.com/clip.mp4"


def test_get_project_asset_url_none_for_missing_file(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_task_dir",
        lambda self, task_id, make=False: _make_dir(str(tmp_path), task_id, make),
        raising=False,
    )
    store = FilesystemProjectStore()
    store.save_script("proj-missing", "guion")
    project = TimelineProject(
        project_id="proj-missing", task_id="proj-missing",
        tracks=[TimelineTrack(id="video_1", type="video", name="Video", items=[
            TimelineItem(id="item_1", local_path="gone.mp4", start_sec=0.0, duration_sec=3.0),
        ])],
    )
    store.save_timeline("proj-missing", project)

    client = TestClient(app)
    resp = client.get("/api/v1/projects/proj-missing")

    item = resp.json()["data"]["timeline"]["tracks"][0]["items"][0]
    assert item["asset_url"] is None


def test_narration_synthesizes_audio_and_subtitle(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_task_dir",
        lambda self, task_id, make=False: _make_dir(str(tmp_path), task_id, make),
        raising=False,
    )
    store = FilesystemProjectStore()
    store.save_script("proj-voice", "Este es el guion de prueba.")

    from app.controllers.v1 import projects as projects_controller

    def fake_generate_audio(task_id, params, video_script, **kwargs):
        assert task_id == "proj-voice"
        assert video_script == "Este es el guion de prueba."
        assert params.voice_name == "es-MX-DaliaNeural"
        return "/fake/audio.mp3", 12, object()

    def fake_generate_subtitle(task_id, params, video_script, sub_maker, audio_file):
        assert audio_file == "/fake/audio.mp3"
        return "/fake/subtitle.srt"

    monkeypatch.setattr(projects_controller.legacy_task, "generate_audio", fake_generate_audio)
    monkeypatch.setattr(projects_controller.legacy_task, "generate_subtitle", fake_generate_subtitle)

    client = TestClient(app)
    resp = client.post(
        "/api/v1/projects/proj-voice/narration",
        json={"voice_name": "es-MX-DaliaNeural", "voice_rate": 1.1, "subtitle_enabled": True},
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data == {
        "project_id": "proj-voice",
        "narration_audio_path": "/fake/audio.mp3",
        "audio_duration_sec": 12,
        "subtitle_path": "/fake/subtitle.srt",
    }


def test_narration_requires_script(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_task_dir",
        lambda self, task_id, make=False: _make_dir(str(tmp_path), task_id, make),
        raising=False,
    )
    client = TestClient(app)
    resp = client.post("/api/v1/projects/proj-no-script/narration", json={})
    assert resp.status_code == 400


def test_narration_returns_500_when_audio_generation_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)
    monkeypatch.setattr(
        FilesystemProjectStore,
        "_task_dir",
        lambda self, task_id, make=False: _make_dir(str(tmp_path), task_id, make),
        raising=False,
    )
    store = FilesystemProjectStore()
    store.save_script("proj-fail", "guion")

    from app.controllers.v1 import projects as projects_controller

    monkeypatch.setattr(
        projects_controller.legacy_task, "generate_audio",
        lambda task_id, params, video_script, **kwargs: (None, None, None),
    )

    client = TestClient(app)
    resp = client.post("/api/v1/projects/proj-fail/narration", json={})
    assert resp.status_code == 500
