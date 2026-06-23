"""Base types for the LLM provider strategy pattern."""
from typing import Protocol, runtime_checkable

from pydantic import BaseModel


class LLMProviderError(RuntimeError):
    """Raised when a provider call fails after exhausting retries."""
    def __init__(self, provider: str, cause: Exception) -> None:
        super().__init__(f"[{provider}] {cause}")
        self.provider = provider
        self.cause = cause


class LLMConfigError(ValueError):
    """Raised when a provider is misconfigured (missing key/model/url)."""


@runtime_checkable
class LLMProvider(Protocol):
    name: str

    def generate(self, prompt: str, *, json_mode: bool = False) -> str:
        ...


class ScriptResponse(BaseModel):
    paragraphs: list[str]
    language: str = ""


class TermsResponse(BaseModel):
    terms: list[str]
