"""OpenAI-compatible provider: handles openai, groq, deepseek, ollama, and 9 others."""
from __future__ import annotations

from typing import Any

from loguru import logger
from openai import AzureOpenAI, OpenAI

from app.config import config
from app.services.llm import (
    _build_deepseek_extra_body,
    _extract_chat_completion_text,
    _get_llm_timeout,
    _normalize_text_response,
    _warn_if_deprecated_deepseek_model,
)

from .base import LLMConfigError, LLMProviderError

# Provider config table: each entry has config key prefixes.
# "key"=api key cfg name, "model"=model cfg name, "url"=base_url cfg name,
# "default_url"=fallback if url is empty/None, "needs_key"=True unless anonymous.
_PROVIDER_TABLE: dict[str, dict[str, Any]] = {
    "openai":     {"key": "openai_api_key",     "model": "openai_model_name",     "url": "openai_base_url",     "default_url": "https://api.openai.com/v1"},
    "groq":       {"key": "groq_api_key",        "model": "groq_model_name",       "url": "groq_base_url",       "default_url": "https://api.groq.com/openai/v1", "default_model": "llama-3.3-70b-versatile"},
    "deepseek":   {"key": "deepseek_api_key",    "model": "deepseek_model_name",   "url": "deepseek_base_url",   "default_url": "https://api.deepseek.com",        "default_model": "deepseek-v4-flash"},
    "moonshot":   {"key": "moonshot_api_key",    "model": "moonshot_model_name",   "url": None,                  "default_url": "https://api.moonshot.cn/v1"},
    "aihubmix":   {"key": "aihubmix_api_key",   "model": "aihubmix_model_name",   "url": "aihubmix_base_url",   "default_url": "https://aihubmix.com/v1",         "default_model": "gpt-5.4-mini"},
    "aimlapi":    {"key": "aimlapi_api_key",     "model": "aimlapi_model_name",    "url": "aimlapi_base_url",    "default_url": "https://api.aimlapi.com/v1",      "default_model": "openai/gpt-4o-mini"},
    "oneapi":     {"key": "oneapi_api_key",      "model": "oneapi_model_name",     "url": "oneapi_base_url",     "default_url": ""},
    "grok":       {"key": "grok_api_key",        "model": "grok_model_name",       "url": "grok_base_url",       "default_url": "https://api.x.ai/v1"},
    "minimax":    {"key": "minimax_api_key",     "model": "minimax_model_name",    "url": "minimax_base_url",    "default_url": "https://api.minimax.io/v1"},
    "mimo":       {"key": "mimo_api_key",        "model": "mimo_model_name",       "url": "mimo_base_url",       "default_url": "https://api.xiaomimimo.com/v1",   "default_model": "mimo-v2.5-pro"},
    "modelscope": {"key": "modelscope_api_key",  "model": "modelscope_model_name", "url": "modelscope_base_url", "default_url": "https://api-inference.modelscope.cn/v1/", "streaming": True},
    "azure":      {"key": "azure_api_key",       "model": "azure_model_name",      "url": "azure_base_url",      "default_url": "",  "azure": True},
    "ollama":     {"key": None,                  "model": "ollama_model_name",     "url": "ollama_base_url",     "default_url": "",  "needs_key": False},
}


class OpenAICompatProvider:
    """Table-driven provider for all OpenAI-compatible endpoints."""

    def __init__(self, provider_name: str) -> None:
        self.name = provider_name
        cfg = _PROVIDER_TABLE.get(provider_name, {
            "key": f"{provider_name}_api_key",
            "model": f"{provider_name}_model_name",
            "url": f"{provider_name}_base_url",
            "default_url": "",
        })
        needs_key = cfg.get("needs_key", True)

        # Resolve API key
        key_cfg = cfg.get("key")
        self._api_key: str = config.app.get(key_cfg, "") if key_cfg else "ollama"
        if needs_key and not self._api_key:
            raise LLMConfigError(
                f"{provider_name}: api_key is not set — configure {key_cfg} in config.toml"
            )

        # Resolve model
        model_cfg = cfg.get("model", "")
        self._model: str = config.app.get(model_cfg, "") or cfg.get("default_model", "")
        if not self._model:
            raise LLMConfigError(
                f"{provider_name}: model_name is not set — configure {model_cfg} in config.toml"
            )

        # Resolve base_url
        url_cfg = cfg.get("url")
        self._base_url: str = (config.app.get(url_cfg, "") if url_cfg else "") or cfg.get("default_url", "")
        if needs_key and not self._base_url and not cfg.get("azure"):
            raise LLMConfigError(
                f"{provider_name}: base_url is not set — configure {url_cfg} in config.toml"
            )

        self._azure = bool(cfg.get("azure"))
        self._streaming = bool(cfg.get("streaming"))

        # Build the client eagerly so construction-time errors surface immediately
        # and tests can assert on client kwargs without calling generate().
        timeout = _get_llm_timeout()
        if self._azure:
            api_version = config.app.get("azure_api_version", "2024-02-15-preview")
            azure_kwargs: dict[str, Any] = {
                "api_key": self._api_key,
                "api_version": api_version,
                "azure_endpoint": self._base_url,
            }
            if timeout is not None:
                azure_kwargs["timeout"] = timeout
            self._client = AzureOpenAI(**azure_kwargs)
        else:
            client_kwargs: dict[str, Any] = {
                "api_key": self._api_key,
                "base_url": self._base_url,
            }
            if timeout is not None:
                client_kwargs["timeout"] = timeout
            self._client = OpenAI(**client_kwargs)

    def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        try:
            return self._call(prompt, json_mode=json_mode)
        except LLMConfigError:
            raise
        except Exception as exc:
            logger.exception(f"[{self.name}] provider call failed")
            raise LLMProviderError(self.name, exc) from exc

    def _call(self, prompt: str, *, json_mode: bool) -> str:
        if self._azure:
            return self._call_azure(prompt, json_mode=json_mode)

        if self._streaming:
            return self._call_streaming(prompt, json_mode=json_mode)

        if self.name == "deepseek":
            return self._call_deepseek(prompt, json_mode=json_mode)

        call_kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if json_mode:
            call_kwargs["response_format"] = {"type": "json_object"}
        response = self._client.chat.completions.create(**call_kwargs)
        return _extract_chat_completion_text(response, self.name)

    def _call_azure(self, prompt: str, *, json_mode: bool) -> str:
        call_kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
        }
        if json_mode:
            call_kwargs["response_format"] = {"type": "json_object"}
        response = self._client.chat.completions.create(**call_kwargs)
        return _extract_chat_completion_text(response, self.name)

    def _call_streaming(self, prompt: str, *, json_mode: bool) -> str:
        create_kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "extra_body": {"enable_thinking": False},
            "stream": True,
        }
        if json_mode:
            create_kwargs["response_format"] = {"type": "json_object"}
        response = self._client.chat.completions.create(**create_kwargs)
        content = ""
        for chunk in response:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta and delta.content:
                content += delta.content
        if not content.strip():
            raise ValueError(f"[{self.name}] empty streaming response")
        return _normalize_text_response(content, self.name)

    def _call_deepseek(self, prompt: str, *, json_mode: bool) -> str:
        _warn_if_deprecated_deepseek_model(self._model)
        thinking_enabled = bool(config.app.get("deepseek_thinking_enabled", False))
        kwargs: dict[str, Any] = {
            "model": self._model,
            "messages": [{"role": "user", "content": prompt}],
            "extra_body": _build_deepseek_extra_body(thinking_enabled),
        }
        if thinking_enabled:
            reasoning_effort = config.app.get("deepseek_reasoning_effort", "high")
            if reasoning_effort:
                kwargs["reasoning_effort"] = reasoning_effort
        if json_mode and not thinking_enabled:
            kwargs["response_format"] = {"type": "json_object"}
        try:
            response = self._client.chat.completions.create(**kwargs)
        except Exception as exc:
            msg = str(exc)
            if "thinking" in msg.lower() or "reasoning" in msg.lower():
                raise ValueError(
                    f"[deepseek] request rejected thinking/reasoning options. "
                    "Set deepseek_thinking_enabled = false or verify model name. "
                    f"Original error: {msg}"
                ) from exc
            raise
        return _extract_chat_completion_text(response, self.name)
