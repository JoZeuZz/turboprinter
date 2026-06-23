"""LLM provider registry for the Personal Quality Stack."""
from .base import LLMConfigError, LLMProvider, LLMProviderError

_REGISTRY: dict[str, type] = {}


def register(name: str):
    """Class decorator: register a provider under *name*."""
    def decorator(cls):
        _REGISTRY[name] = cls
        return cls
    return decorator


def get_provider(name: str) -> "LLMProvider":
    """Return an instantiated provider for *name*, falling back to openai_compat."""
    from .openai_compat import OpenAICompatProvider
    cls = _REGISTRY.get(name) or OpenAICompatProvider
    return cls(name)


__all__ = [
    "LLMConfigError",
    "LLMProvider",
    "LLMProviderError",
    "get_provider",
    "register",
]
