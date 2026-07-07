# test/controllers/test_project_preflight_endpoint.py
from __future__ import annotations

import json
import os

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.config import config as app_config
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@pytest.fixture
def project_mode(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "project_mode_enabled", True, raising=False)

    # NOTE: FilesystemProjectStore._task_dir() (used by load_timeline/save_timeline/
    # etc.) reads self._base directly and does not call _base_dir() — only
    # list_projects() does. So isolation must patch _task_dir, not _base_dir,
    # or reads/writes silently fall through to the real utils.task_dir() on disk.
    def _fake_task_dir(self, task_id, *, make=False):
        path = os.path.join(str(tmp_path), task_id)
        if make:
            os.makedirs(path, exist_ok=True)
        return path

    monkeypatch.setattr(
        FilesystemProjectStore, "_task_dir", _fake_task_dir, raising=False,
    )
    return tmp_path


def _write_timeline(tmp_path, task_id, clip_path):
    proj_dir = tmp_path / task_id
    proj_dir.mkdir()
    (tmp_path / "clip.mp4").write_bytes(b"x") if False else None
    timeline = {
        "project_id": task_id, "task_id": task_id,
        "tracks": [{
            "id": "video_1", "type": "video", "name": "Video",
            "items": [{
                "id": "item_1", "media_id": "mc-1", "local_path": clip_path,
                "start_sec": 0.0, "duration_sec": 3.0, "trim_start_sec": 0.0,
                "trim_end_sec": 3.0, "provider": "pexels",
            }],
        }],
        "export": {"width": 1080, "height": 1920, "fps": 30},
    }
    (proj_dir / "timeline_project.json").write_text(json.dumps(timeline))


def test_preflight_endpoint_404_when_project_mode_disabled(monkeypatch):
    # This dev environment's config.toml has [project_mode].enabled = true,
    # so force it off explicitly rather than relying on an unset default
    # (mirrors test_projects_list.py::test_list_projects_project_mode_disabled).
    monkeypatch.setattr(app_config, "project_mode_enabled", False, raising=False)
    client = TestClient(app)
    resp = client.get("/api/v1/projects/any-id/preflight")
    assert resp.status_code == 404


def test_preflight_endpoint_400_when_no_timeline(project_mode):
    client = TestClient(app)
    resp = client.get("/api/v1/projects/no-such-project/preflight")
    assert resp.status_code == 400


def test_preflight_endpoint_returns_structured_result(project_mode, tmp_path):
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"x")
    _write_timeline(tmp_path, "task-1", str(clip))
    client = TestClient(app)
    resp = client.get("/api/v1/projects/task-1/preflight")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["project_id"] == "task-1"
    assert "valid" in data
    assert "errors" in data
    assert "warnings" in data
    assert "checks" in data


def test_render_blocked_when_preflight_has_errors(project_mode, tmp_path):
    _write_timeline(tmp_path, "task-2", str(tmp_path / "missing-clip.mp4"))
    client = TestClient(app)
    resp = client.post("/api/v1/projects/task-2/render", json={})
    assert resp.status_code == 400
    assert "preflight" in resp.json()["message"].lower()


def test_render_blocked_on_warnings_without_override(project_mode, tmp_path):
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"x")
    _write_timeline(tmp_path, "task-3", str(clip))
    client = TestClient(app)
    resp = client.post("/api/v1/projects/task-3/render", json={})
    assert resp.status_code == 400
    assert "warning" in resp.json()["message"].lower()


def test_render_proceeds_with_allow_preflight_warnings(project_mode, tmp_path):
    clip = tmp_path / "clip.mp4"
    clip.write_bytes(b"x")
    _write_timeline(tmp_path, "task-4", str(clip))
    client = TestClient(app)
    resp = client.post(
        "/api/v1/projects/task-4/render",
        json={"allow_preflight_warnings": True},
    )
    assert resp.status_code == 202
