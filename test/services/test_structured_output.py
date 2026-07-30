from __future__ import annotations

import pytest
from pydantic import BaseModel

from app.infrastructure.llm import structured_output as so


class _Schema(BaseModel):
    name: str
    value: int


def test_capabilities_maps_litellm_helpers(monkeypatch):
    monkeypatch.setattr(so.litellm, "supports_response_schema", lambda model: True)
    monkeypatch.setattr(so.litellm, "supports_function_calling", lambda model: True)
    provider = so.LiteLLMStructuredProvider()
    caps = provider.capabilities(model="gpt-4o-mini")
    assert caps.supports_json_schema is True
    assert caps.supports_json_mode is True
    assert caps.supports_tools is True


def test_capabilities_tolerates_helper_errors(monkeypatch):
    def _boom(model):
        raise RuntimeError("unknown model")

    monkeypatch.setattr(so.litellm, "supports_response_schema", _boom)
    monkeypatch.setattr(so.litellm, "supports_function_calling", _boom)
    provider = so.LiteLLMStructuredProvider()
    caps = provider.capabilities(model="weird-model")
    assert caps.supports_json_schema is False
    assert caps.supports_tools is False


def test_generate_structured_with_schema_support(monkeypatch):
    captured = {}

    class _Msg:
        content = '{"name": "a", "value": 1}'

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    def _fake_completion(**kwargs):
        captured.update(kwargs)
        return _Resp()

    monkeypatch.setattr(so.litellm, "supports_response_schema", lambda model: True)
    monkeypatch.setattr(so.litellm, "completion", _fake_completion)
    provider = so.LiteLLMStructuredProvider()
    result = provider.generate_structured("hi", _Schema, model="gpt-4o-mini")
    assert isinstance(result, _Schema)
    assert result.value == 1
    assert captured["response_format"] is _Schema
    assert captured["drop_params"] is True


def test_generate_structured_json_mode_fallback(monkeypatch):
    class _Msg:
        content = '{"name": "b", "value": 2}'

    class _Choice:
        message = _Msg()

    class _Resp:
        choices = [_Choice()]

    captured = {}

    def _fake_completion(**kwargs):
        captured.update(kwargs)
        return _Resp()

    monkeypatch.setattr(so.litellm, "supports_response_schema", lambda model: False)
    monkeypatch.setattr(so.litellm, "completion", _fake_completion)
    provider = so.LiteLLMStructuredProvider()
    result = provider.generate_structured("hi", _Schema, model="ollama/x")
    assert result.value == 2
    assert captured["response_format"] == {"type": "json_object"}


def test_generate_structured_requires_model(monkeypatch):
    monkeypatch.setattr(so.config, "app", {})
    provider = so.LiteLLMStructuredProvider()
    with pytest.raises(ValueError):
        provider.generate_structured("hi", _Schema, model=None)
