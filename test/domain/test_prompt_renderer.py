# test/domain/test_prompt_renderer.py
from __future__ import annotations

import pytest

from app.domain.prompts.renderer import (
    PromptRenderError,
    SUPPORTED_VARIABLES,
    render_prompt,
    render_template_pair,
)


def test_supported_variables_are_the_documented_six():
    assert set(SUPPORTED_VARIABLES) == {
        "topic", "language", "duration", "platform", "workspace", "style",
    }


def test_render_prompt_substitutes_known_variables():
    result = render_prompt(
        "Tema: {{topic}}. Idioma: {{language}}.",
        {"topic": "gatos", "language": "es"},
    )
    assert result == "Tema: gatos. Idioma: es."


def test_render_prompt_ignores_extra_variables_not_referenced():
    result = render_prompt("Tema: {{topic}}.", {"topic": "gatos", "style": "unused"})
    assert result == "Tema: gatos."


def test_render_prompt_no_placeholders_returns_text_unchanged():
    assert render_prompt("Texto fijo sin variables.", {}) == "Texto fijo sin variables."


def test_render_prompt_raises_on_missing_variable():
    with pytest.raises(PromptRenderError) as exc_info:
        render_prompt("Tema: {{topic}}. Duración: {{duration}}.", {"topic": "gatos"})
    assert "duration" in str(exc_info.value)


def test_render_prompt_missing_variable_reports_all_missing_names():
    with pytest.raises(PromptRenderError) as exc_info:
        render_prompt("{{topic}} {{platform}} {{workspace}}", {})
    message = str(exc_info.value)
    assert "topic" in message and "platform" in message and "workspace" in message


def test_render_prompt_treats_empty_string_value_as_missing():
    with pytest.raises(PromptRenderError):
        render_prompt("{{topic}}", {"topic": ""})


def test_render_prompt_does_not_crash_on_malformed_braces():
    # An unclosed "{{" never matches the placeholder pattern, so it's just
    # literal text -- no exception, no partial substitution.
    result = render_prompt("Tema roto: {{topic sin cerrar", {"topic": "gatos"})
    assert result == "Tema roto: {{topic sin cerrar"


def test_render_prompt_empty_template_returns_empty_string():
    assert render_prompt("", {"topic": "gatos"}) == ""


def test_render_template_pair_renders_both_strings():
    system, user = render_template_pair(
        "Sistema para {{topic}}.",
        "Usuario quiere {{topic}} en {{language}}.",
        {"topic": "gatos", "language": "es"},
    )
    assert system == "Sistema para gatos."
    assert user == "Usuario quiere gatos en es."


def test_render_template_pair_raises_if_either_side_missing_a_variable():
    with pytest.raises(PromptRenderError):
        render_template_pair("Sistema para {{topic}}.", "{{duration}}", {"topic": "gatos"})
