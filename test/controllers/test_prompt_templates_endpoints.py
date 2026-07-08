from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.asgi import app
from app.config import config as app_config
from app.infrastructure.storage.prompt_template_store import PromptTemplateStore


@pytest.fixture
def templates_enabled(tmp_path, monkeypatch):
    monkeypatch.setattr(app_config, "prompt_templates_enabled", True, raising=False)
    monkeypatch.setattr(PromptTemplateStore, "_dir", lambda self, make=False: str(tmp_path), raising=False)
    return tmp_path


def _create(client, name="Curiosidades ES"):
    return client.post("/api/v1/prompt-templates", json={
        "name": name, "content_type": "curiosidades", "language": "es",
        "system_prompt": "Eres un guionista.", "user_prompt_template": "Tema: {{topic}}",
    })


def test_prompt_templates_404_when_disabled():
    client = TestClient(app)
    assert client.get("/api/v1/prompt-templates").status_code == 404
    assert client.post("/api/v1/prompt-templates", json={
        "name": "x", "content_type": "curiosidades",
        "system_prompt": "s", "user_prompt_template": "u",
    }).status_code == 404


def test_create_requires_name(templates_enabled):
    client = TestClient(app)
    resp = client.post("/api/v1/prompt-templates", json={
        "name": "  ", "content_type": "x", "system_prompt": "s", "user_prompt_template": "u",
    })
    assert resp.status_code == 400


def test_create_also_creates_active_version_1(templates_enabled):
    client = TestClient(app)
    created = _create(client)
    assert created.status_code == 200
    template = created.json()["data"]["template"]
    assert template["active_version_id"]

    versions = client.get(f"/api/v1/prompt-templates/{template['id']}/versions")
    assert versions.status_code == 200
    version_list = versions.json()["data"]["versions"]
    assert len(version_list) == 1
    assert version_list[0]["version"] == 1
    assert version_list[0]["active"] is True


def test_get_unknown_404(templates_enabled):
    client = TestClient(app)
    assert client.get("/api/v1/prompt-templates/ghost").status_code == 404


def test_list_returns_created_templates(templates_enabled):
    client = TestClient(app)
    _create(client, name="A")
    _create(client, name="B")
    resp = client.get("/api/v1/prompt-templates")
    assert resp.status_code == 200
    names = {t["name"] for t in resp.json()["data"]["templates"]}
    assert names == {"A", "B"}


def test_update_replaces_metadata_fields_and_keeps_prompt_content(templates_enabled):
    client = TestClient(app)
    created = _create(client, name="Original")
    template_id = created.json()["data"]["template"]["id"]
    original_system_prompt = created.json()["data"]["template"]["system_prompt"]

    updated = client.put(f"/api/v1/prompt-templates/{template_id}", json={
        "name": "Renamed", "content_type": "misterio", "language": "en",
    })
    assert updated.status_code == 200
    body = updated.json()["data"]["template"]
    assert body["id"] == template_id
    assert body["name"] == "Renamed"
    assert body["content_type"] == "misterio"
    assert body["language"] == "en"
    assert body["system_prompt"] == original_system_prompt


def test_update_unknown_404(templates_enabled):
    client = TestClient(app)
    resp = client.put("/api/v1/prompt-templates/ghost", json={
        "name": "x", "content_type": "x",
    })
    assert resp.status_code == 404


def test_add_version_and_activate(templates_enabled):
    client = TestClient(app)
    template_id = _create(client).json()["data"]["template"]["id"]

    v2 = client.post(f"/api/v1/prompt-templates/{template_id}/versions", json={
        "system_prompt": "Sistema v2", "user_prompt_template": "Tema v2: {{topic}}",
        "model_hint": "gpt-4o-mini", "change_notes": "mejora de gancho",
    })
    assert v2.status_code == 200
    v2_id = v2.json()["data"]["version"]["id"]
    assert v2.json()["data"]["version"]["version"] == 2

    activated = client.post(f"/api/v1/prompt-templates/{template_id}/activate-version", json={
        "version_id": v2_id,
    })
    assert activated.status_code == 200
    template = activated.json()["data"]["template"]
    assert template["active_version_id"] == v2_id
    assert template["system_prompt"] == "Sistema v2"

    versions = client.get(f"/api/v1/prompt-templates/{template_id}/versions").json()["data"]["versions"]
    active_flags = {v["id"]: v["active"] for v in versions}
    assert active_flags[v2_id] is True


def test_add_version_unknown_template_404(templates_enabled):
    client = TestClient(app)
    resp = client.post("/api/v1/prompt-templates/ghost/versions", json={
        "system_prompt": "s", "user_prompt_template": "u",
    })
    assert resp.status_code == 404


def test_activate_unknown_version_404(templates_enabled):
    client = TestClient(app)
    template_id = _create(client).json()["data"]["template"]["id"]
    resp = client.post(f"/api/v1/prompt-templates/{template_id}/activate-version", json={
        "version_id": "ghost",
    })
    assert resp.status_code == 404


def test_traversal_id_rejected(templates_enabled):
    client = TestClient(app)
    resp = client.get("/api/v1/prompt-templates/..\\escape")
    assert resp.status_code == 400
