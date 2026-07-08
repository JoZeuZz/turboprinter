from __future__ import annotations

from app.domain.prompts.seeds import DEFAULT_TEMPLATES, seed_default_templates
from app.infrastructure.storage.prompt_template_store import PromptTemplateStore


def test_default_templates_cover_the_five_required_formulas():
    names = {entry["name"] for entry in DEFAULT_TEMPLATES}
    assert names == {
        "Reddit Story ES", "Curiosidades ES", "Misterio ES", "Historia ES", "Top List ES",
    }


def test_seed_creates_five_templates(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    created = seed_default_templates(store)
    assert len(created) == 5
    templates = store.list_templates()
    assert len(templates) == 5
    for template in templates:
        assert template.language == "es"
        assert template.active_version_id is not None
        versions = store.list_versions(template.id)
        assert len(versions) == 1
        assert versions[0].active is True


def test_seed_is_idempotent(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    first = seed_default_templates(store)
    assert len(first) == 5
    second = seed_default_templates(store)
    assert second == []
    assert len(store.list_templates()) == 5


def test_seed_templates_reference_only_supported_variables(tmp_path):
    from app.domain.prompts.renderer import SUPPORTED_VARIABLES, _find_placeholders

    for entry in DEFAULT_TEMPLATES:
        placeholders = _find_placeholders(entry["system_prompt"]) | _find_placeholders(
            entry["user_prompt_template"]
        )
        assert placeholders <= set(SUPPORTED_VARIABLES)
