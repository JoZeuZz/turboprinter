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
    from .gemini import GeminiProvider
    from .openai_compat import OpenAICompatProvider

    # Explicit registrations: gemini uses its own provider;
    # the 13 OpenAI-compatible providers use OpenAICompatProvider.
    _explicit: dict[str, type] = {
        "gemini": GeminiProvider,
        **{k: OpenAICompatProvider for k in (
            "openai", "groq", "deepseek", "ollama", "moonshot",
            "aihubmix", "aimlapi", "oneapi", "grok", "minimax",
            "mimo", "modelscope", "azure",
        )},
    }
    cls = _explicit.get(name) or _REGISTRY.get(name) or OpenAICompatProvider
    return cls(name)


__all__ = [
    "LLMConfigError",
    "LLMProvider",
    "LLMProviderError",
    "get_provider",
    "register",
]
