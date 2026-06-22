from __future__ import annotations

from typing import Protocol, TypeVar

import litellm
from loguru import logger
from pydantic import BaseModel

from app.config import config

T = TypeVar("T", bound=BaseModel)


class LLMCapabilities(BaseModel):
    supports_json_mode: bool
    supports_json_schema: bool
    supports_tools: bool = False
    supports_vision: bool = False
    max_context_tokens: int | None = None


class StructuredLLMProvider(Protocol):
    def capabilities(self, model: str | None = None) -> LLMCapabilities: ...

    def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        model: str | None = None,
        temperature: float = 0.4,
    ) -> T: ...


class LiteLLMStructuredProvider:
    """Gateway único de salida estructurada usando litellm.

    Resuelve el modelo desde el argumento o desde config.app['litellm_model_name'].
    Usa response_format=schema cuando el modelo soporta JSON schema; si no, cae a
    JSON mode + validación Pydantic manual.
    """

    def _resolve_model(self, model: str | None) -> str:
        resolved = model or config.app.get("litellm_model_name")
        if not resolved:
            raise ValueError(
                "litellm model not set: pass model= or set litellm_model_name in config.toml"
            )
        return resolved

    def capabilities(self, model: str | None = None) -> LLMCapabilities:
        resolved = self._resolve_model(model)
        try:
            schema = bool(litellm.supports_response_schema(resolved))
        except Exception:
            schema = False
        try:
            tools = bool(litellm.supports_function_calling(resolved))
        except Exception:
            tools = False
        return LLMCapabilities(
            supports_json_mode=True,
            supports_json_schema=schema,
            supports_tools=tools,
        )

    def generate_structured(
        self,
        prompt: str,
        schema: type[T],
        model: str | None = None,
        temperature: float = 0.4,
    ) -> T:
        resolved = self._resolve_model(model)
        try:
            use_schema = bool(litellm.supports_response_schema(resolved))
        except Exception:
            use_schema = False

        response_format = schema if use_schema else {"type": "json_object"}
        logger.info(
            f"[structured] model={resolved} json_schema={use_schema} schema={schema.__name__}"
        )
        response = litellm.completion(
            model=resolved,
            messages=[{"role": "user", "content": prompt}],
            response_format=response_format,
            temperature=temperature,
            drop_params=True,
        )
        choices = getattr(response, "choices", None)
        if not choices:
            raise ValueError("litellm returned empty response")
        content = choices[0].message.content
        if not content:
            raise ValueError("litellm returned empty content")
        return schema.model_validate_json(content)
