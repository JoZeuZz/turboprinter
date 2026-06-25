"""Tests for GET /api/v1/voices endpoint."""
from __future__ import annotations
import pytest
from fastapi.testclient import TestClient
from app.asgi import app


@pytest.fixture
def client():
    return TestClient(app)


def test_voices_azure_v1_returns_list(client):
    resp = client.get("/api/v1/voices?provider=azure-tts-v1")
    assert resp.status_code == 200
    voices = resp.json()["data"]["voices"]
    assert isinstance(voices, list)
    assert len(voices) > 0


def test_voices_azure_v1_excludes_v2(client):
    resp = client.get("/api/v1/voices?provider=azure-tts-v1")
    voices = resp.json()["data"]["voices"]
    values = [v["value"] for v in voices]
    assert not any("V2" in v for v in values)


def test_voices_azure_v2_only_v2(client):
    resp = client.get("/api/v1/voices?provider=azure-tts-v2")
    voices = resp.json()["data"]["voices"]
    assert len(voices) > 0
    values = [v["value"] for v in voices]
    assert all("V2" in v for v in values)


def test_voices_siliconflow(client):
    resp = client.get("/api/v1/voices?provider=siliconflow")
    assert resp.status_code == 200
    voices = resp.json()["data"]["voices"]
    assert len(voices) > 0
    assert all(v["value"].startswith("siliconflow:") for v in voices)


def test_voices_gemini(client):
    resp = client.get("/api/v1/voices?provider=gemini-tts")
    voices = resp.json()["data"]["voices"]
    assert all(v["value"].startswith("gemini:") for v in voices)


def test_voices_mimo(client):
    resp = client.get("/api/v1/voices?provider=mimo-tts")
    voices = resp.json()["data"]["voices"]
    assert all(v["value"].startswith("mimo:") for v in voices)


def test_voices_no_voice_returns_empty(client):
    resp = client.get("/api/v1/voices?provider=no-voice")
    assert resp.status_code == 200
    assert resp.json()["data"]["voices"] == []


def test_voices_each_entry_has_value_and_label(client):
    resp = client.get("/api/v1/voices?provider=siliconflow")
    for voice in resp.json()["data"]["voices"]:
        assert "value" in voice
        assert "label" in voice
        assert isinstance(voice["value"], str)
        assert isinstance(voice["label"], str)


def test_voices_default_provider_is_azure_v1(client):
    resp = client.get("/api/v1/voices")
    assert resp.status_code == 200
    voices = resp.json()["data"]["voices"]
    assert len(voices) > 0
