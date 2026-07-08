# test/services/test_prompt_template_service.py
from __future__ import annotations

import pytest

from app.application.services.prompt_templates import (
    PromptTemplateError,
    PromptTemplateService,
)
from app.infrastructure.storage.prompt_template_store import PromptTemplateStore


@pytest.fixture
def service(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    return PromptTemplateService(store)


def test_create_template_also_creates_version_1_active(service):
    template = service.create_template(
        name="Curiosidades ES", content_type="curiosidades", language="es",
        system_prompt="s1", user_prompt_template="u1", expected_schema=None, metadata={},
    )
    assert template.active_version_id is not None
    versions = service._store.list_versions(template.id)
    assert len(versions) == 1
    assert versions[0].version == 1
    assert versions[0].active is True
    assert versions[0].id == template.active_version_id


def test_add_version_increments_version_number(service):
    template = service.create_template(
        name="T", content_type="x", language="es",
        system_prompt="s1", user_prompt_template="u1", expected_schema=None, metadata={},
    )
    v2 = service.add_version(
        template.id, system_prompt="s2", user_prompt_template="u2",
        expected_schema=None, model_hint=None, change_notes="tweak",
    )
    assert v2.version == 2
    assert v2.active is False


def test_add_version_unknown_template_raises(service):
    with pytest.raises(PromptTemplateError):
        service.add_version(
            "ghost", system_prompt="s", user_prompt_template="u",
            expected_schema=None, model_hint=None, change_notes=None,
        )


def test_activate_version_switches_active_flag_and_refreshes_template(service):
    template = service.create_template(
        name="T", content_type="x", language="es",
        system_prompt="s1", user_prompt_template="u1", expected_schema=None, metadata={},
    )
    v1_id = template.active_version_id
    v2 = service.add_version(
        template.id, system_prompt="s2", user_prompt_template="u2",
        expected_schema=None, model_hint="gpt-4o-mini", change_notes=None,
    )
    updated = service.activate_version(template.id, v2.id)
    assert updated.active_version_id == v2.id
    assert updated.system_prompt == "s2"
    assert updated.user_prompt_template == "u2"

    v1_reloaded = service._store.load_version(template.id, v1_id)
    v2_reloaded = service._store.load_version(template.id, v2.id)
    assert v1_reloaded.active is False
    assert v2_reloaded.active is True


def test_activate_version_unknown_template_raises(service):
    with pytest.raises(PromptTemplateError):
        service.activate_version("ghost", "also-ghost")


def test_activate_version_unknown_version_raises(service):
    template = service.create_template(
        name="T", content_type="x", language="es",
        system_prompt="s1", user_prompt_template="u1", expected_schema=None, metadata={},
    )
    with pytest.raises(PromptTemplateError):
        service.activate_version(template.id, "ghost-version")
