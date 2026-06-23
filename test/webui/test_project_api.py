from __future__ import annotations

import pytest

from webui.project_api import ProjectApiClient, ProjectApiError


class _Resp:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {"data": {"ok": True}}

    def json(self):
        return self._payload


def test_default_base_url():
    client = ProjectApiClient()
    assert client.base_url.endswith("/api/v1")


def test_create_from_script_posts_and_returns_data(monkeypatch):
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        return _Resp(200, {"data": {"project_id": "p1"}})

    import webui.project_api as pa
    monkeypatch.setattr(pa.requests, "post", fake_post)
    client = ProjectApiClient(base_url="http://x/api/v1")
    data = client.create_from_script("Uno.", "es", topic="demo")
    assert data["project_id"] == "p1"
    assert captured["url"] == "http://x/api/v1/projects/from-script"
    assert captured["json"]["script"] == "Uno."
    assert captured["json"]["topic"] == "demo"


def test_get_project_uses_get(monkeypatch):
    import webui.project_api as pa
    monkeypatch.setattr(pa.requests, "get",
                        lambda url, timeout=None: _Resp(200, {"data": {"project_id": "p1"}}))
    client = ProjectApiClient(base_url="http://x/api/v1")
    assert client.get_project("p1")["project_id"] == "p1"


def test_error_status_raises(monkeypatch):
    import webui.project_api as pa
    monkeypatch.setattr(pa.requests, "get",
                        lambda url, timeout=None: _Resp(404, {"message": "not found"}))
    client = ProjectApiClient(base_url="http://x/api/v1")
    with pytest.raises(ProjectApiError):
        client.get_project("ghost")


def test_apply_commands_payload(monkeypatch):
    captured = {}

    def fake_post(url, json=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        return _Resp(200, {"data": {"applied": 1}})

    import webui.project_api as pa
    monkeypatch.setattr(pa.requests, "post", fake_post)
    client = ProjectApiClient(base_url="http://x/api/v1")
    cmds = [{"type": "trim", "track_id": "video_1", "item_id": "i1",
             "trim_start_sec": 0.5, "trim_end_sec": 2.0}]
    data = client.apply_commands("p1", cmds)
    assert data["applied"] == 1
    assert captured["url"].endswith("/projects/p1/timeline/commands")
    assert captured["json"]["commands"] == cmds
