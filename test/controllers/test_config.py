from fastapi.testclient import TestClient
from app.asgi import app

client = TestClient(app)


def test_get_config_returns_200():
    response = client.get("/api/v1/config")
    assert response.status_code == 200


def test_get_config_has_required_fields():
    response = client.get("/api/v1/config")
    body = response.json()
    assert body["status"] == 200
    data = body["data"]
    assert "video_sources" in data
    assert "subtitle_position_default" in data
    assert "custom_position_default" in data


def test_get_config_video_sources_contains_pexels():
    response = client.get("/api/v1/config")
    data = response.json()["data"]
    assert "pexels" in data["video_sources"]


def test_get_config_custom_position_is_float():
    response = client.get("/api/v1/config")
    data = response.json()["data"]
    assert isinstance(data["custom_position_default"], float)
