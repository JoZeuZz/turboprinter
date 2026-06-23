from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from app.infrastructure.llm.vision_provider import LiteLLMVisionProvider


def _mock_response(content: str) -> MagicMock:
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def test_score_success():
    """Respuesta JSON válida → VisionScore parseado."""
    provider = LiteLLMVisionProvider(model="ollama/llava")
    payload = json.dumps({"relevance": 0.85, "reason": "shows golden hour sky"})
    with patch("litellm.completion", return_value=_mock_response(payload)) as mock_comp:
        result = provider.score_thumbnail(
            "https://example.com/thumb.jpg", "sunset", "golden sky"
        )
    assert result is not None
    assert abs(result.relevance - 0.85) < 1e-9
    assert result.reason == "shows golden hour sky"
    mock_comp.assert_called_once()
    call_kwargs = mock_comp.call_args.kwargs
    assert call_kwargs["model"] == "ollama/llava"
    messages = call_kwargs["messages"]
    assert messages[0]["content"][0]["type"] == "image_url"
    assert messages[0]["content"][0]["image_url"]["url"] == "https://example.com/thumb.jpg"
    assert messages[0]["content"][1]["type"] == "text"


def test_score_none_url():
    """thumbnail_url=None → None sin llamar litellm."""
    provider = LiteLLMVisionProvider(model="ollama/llava")
    with patch("litellm.completion") as mock_comp:
        result = provider.score_thumbnail(None, "sunset", "golden sky")
    assert result is None
    mock_comp.assert_not_called()


def test_score_litellm_failure():
    """litellm lanza excepción → None."""
    provider = LiteLLMVisionProvider(model="ollama/llava")
    with patch("litellm.completion", side_effect=RuntimeError("connection refused")):
        result = provider.score_thumbnail(
            "https://example.com/thumb.jpg", "sunset", "golden sky"
        )
    assert result is None


def test_score_bad_json():
    """JSON inválido del modelo → None."""
    provider = LiteLLMVisionProvider(model="ollama/llava")
    with patch("litellm.completion", return_value=_mock_response("not json at all")):
        result = provider.score_thumbnail(
            "https://example.com/thumb.jpg", "sunset", "golden sky"
        )
    assert result is None


def test_score_empty_choices():
    """Respuesta sin choices → None."""
    provider = LiteLLMVisionProvider(model="ollama/llava")
    resp = MagicMock()
    resp.choices = []
    with patch("litellm.completion", return_value=resp):
        result = provider.score_thumbnail(
            "https://example.com/thumb.jpg", "sunset", "golden sky"
        )
    assert result is None


def test_prompt_contains_narration_and_query():
    """El prompt enviado al modelo incluye narración y query."""
    provider = LiteLLMVisionProvider(model="ollama/llava")
    payload = json.dumps({"relevance": 0.5, "reason": "ok"})
    with patch("litellm.completion", return_value=_mock_response(payload)) as mock_comp:
        provider.score_thumbnail(
            "https://example.com/thumb.jpg",
            "ocean waves",
            "waves crashing on beach",
        )
    text_content = mock_comp.call_args.kwargs["messages"][0]["content"][1]["text"]
    assert "ocean waves" in text_content
    assert "waves crashing on beach" in text_content
