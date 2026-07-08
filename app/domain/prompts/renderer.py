from __future__ import annotations

import re

# The fixed set of variables every prompt template may reference. Keeping
# this list closed (rather than accepting arbitrary keys) means a template
# author's typo in a placeholder name fails loudly as "missing" instead of
# silently rendering as an empty string.
SUPPORTED_VARIABLES: tuple[str, ...] = (
    "topic", "language", "duration", "platform", "workspace", "style",
)

_PLACEHOLDER_PATTERN = re.compile(r"\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}")


class PromptRenderError(Exception):
    pass


def _find_placeholders(text: str) -> set[str]:
    return set(_PLACEHOLDER_PATTERN.findall(text or ""))


def render_prompt(template_text: str, variables: dict[str, str]) -> str:
    """Render a `{{variable}}` template. Never raises on malformed syntax --
    an unclosed or stray brace simply never matches the placeholder pattern
    and passes through as literal text. Raises PromptRenderError only when a
    *recognized* placeholder has no non-empty value in `variables`.
    """
    text = template_text or ""
    placeholders = _find_placeholders(text)
    missing = sorted(name for name in placeholders if not variables.get(name))
    if missing:
        raise PromptRenderError(f"missing variables: {', '.join(missing)}")

    def _substitute(match: re.Match[str]) -> str:
        return str(variables.get(match.group(1), ""))

    return _PLACEHOLDER_PATTERN.sub(_substitute, text)


def render_template_pair(
    system_prompt: str, user_prompt_template: str, variables: dict[str, str]
) -> tuple[str, str]:
    return render_prompt(system_prompt, variables), render_prompt(user_prompt_template, variables)
