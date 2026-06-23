"""Gemini provider using the google-genai SDK."""
from __future__ import annotations

from loguru import logger

from app.config import config
from app.services.llm import _extract_gemini_text

from .base import LLMConfigError, LLMProviderError

_DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
_DEPRECATED_GEMINI_MODELS = {"gemini-pro", "gemini-1.0-pro"}


class GeminiProvider:
    name = "gemini"

    def __init__(self, provider_name: str = "gemini") -> None:
        self.name = provider_name
        self._api_key: str = config.app.get("gemini_api_key", "") or ""
        if not self._api_key:
            raise LLMConfigError(
                "gemini: api_key is not set — configure gemini_api_key in config.toml"
            )
        model = config.app.get("gemini_model_name", "") or ""
        if not model:
            model = _DEFAULT_GEMINI_MODEL
        elif model in _DEPRECATED_GEMINI_MODELS:
            logger.warning(
                f"gemini model '{model}' is deprecated, fallback to '{_DEFAULT_GEMINI_MODEL}'"
            )
            model = _DEFAULT_GEMINI_MODEL
        self._model = model
        self._base_url: str = config.app.get("gemini_base_url", "") or ""

    def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        try:
            return self._call(prompt, json_mode=json_mode)
        except LLMConfigError:
            raise
        except Exception as exc:
            logger.exception(f"[{self.name}] provider call failed")
            raise LLMProviderError(self.name, exc) from exc

    def _call(self, prompt: str, *, json_mode: bool) -> str:
        from google import genai
        from google.genai import types as genai_types

        if self._base_url:
            client = genai.Client(
                api_key=self._api_key,
                http_options={"base_url": self._base_url},
            )
        else:
            client = genai.Client(api_key=self._api_key)

        safety = [
            genai_types.SafetySetting(category="HARM_CATEGORY_HARASSMENT",        threshold="BLOCK_ONLY_HIGH"),
            genai_types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH",        threshold="BLOCK_ONLY_HIGH"),
            genai_types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT",  threshold="BLOCK_ONLY_HIGH"),
            genai_types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT",  threshold="BLOCK_ONLY_HIGH"),
        ]
        gen_cfg_kwargs = dict(temperature=0.5, top_p=1, top_k=1, max_output_tokens=2048, safety_settings=safety)
        if json_mode:
            gen_cfg_kwargs["response_mime_type"] = "application/json"

        response = client.models.generate_content(
            model=self._model,
            contents=prompt,
            config=genai_types.GenerateContentConfig(**gen_cfg_kwargs),
        )
        return _extract_gemini_text(response, self.name)
