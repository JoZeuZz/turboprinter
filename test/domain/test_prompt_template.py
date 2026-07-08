# test/domain/test_prompt_template.py
from __future__ import annotations

from datetime import datetime, timezone

from app.domain.prompts.models import PromptTemplate, PromptVersion


def test_prompt_template_minimal_fields():
    template = PromptTemplate(
        name="Curiosidades ES",
        content_type="curiosidades",
        system_prompt="Eres un guionista de datos curiosos.",
        user_prompt_template="Tema: {{topic}}",
    )
    assert template.id
    assert template.name == "Curiosidades ES"
    assert template.content_type == "curiosidades"
    assert template.language == "es"
    assert template.active_version_id is None
    assert template.expected_schema is None
    assert template.metadata == {}
    assert isinstance(template.created_at, datetime)
    assert template.created_at.tzinfo == timezone.utc
    assert isinstance(template.updated_at, datetime)


def test_prompt_template_ids_are_unique():
    a = PromptTemplate(name="A", content_type="x", system_prompt="s", user_prompt_template="u")
    b = PromptTemplate(name="B", content_type="x", system_prompt="s", user_prompt_template="u")
    assert a.id != b.id


def test_prompt_version_minimal_fields():
    version = PromptVersion(
        template_id="tmpl-1",
        version=1,
        system_prompt="Eres un guionista.",
        user_prompt_template="Tema: {{topic}}",
    )
    assert version.id
    assert version.template_id == "tmpl-1"
    assert version.version == 1
    assert version.model_hint is None
    assert version.change_notes is None
    assert version.active is False
    assert isinstance(version.created_at, datetime)


def test_prompt_version_expected_schema_and_active_flag():
    version = PromptVersion(
        template_id="tmpl-1",
        version=2,
        system_prompt="s",
        user_prompt_template="u",
        expected_schema={"type": "object"},
        model_hint="gpt-4o-mini",
        change_notes="tightened hook wording",
        active=True,
    )
    assert version.expected_schema == {"type": "object"}
    assert version.model_hint == "gpt-4o-mini"
    assert version.change_notes == "tightened hook wording"
    assert version.active is True
