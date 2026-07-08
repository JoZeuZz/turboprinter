from __future__ import annotations

from app.domain.prompts.models import PromptTemplate, PromptVersion
from app.infrastructure.storage.prompt_template_store import (
    PromptTemplateStore,
    PromptTemplateStoreError,
)


def _template(**overrides) -> PromptTemplate:
    fields = dict(
        name="Curiosidades ES",
        content_type="curiosidades",
        system_prompt="s",
        user_prompt_template="u",
    )
    fields.update(overrides)
    return PromptTemplate(**fields)


def _version(template_id: str, **overrides) -> PromptVersion:
    fields = dict(template_id=template_id, version=1, system_prompt="s", user_prompt_template="u")
    fields.update(overrides)
    return PromptVersion(**fields)


def test_save_and_load_template(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    loaded = store.load_template(template.id)
    assert loaded is not None
    assert loaded.id == template.id
    assert loaded.name == "Curiosidades ES"


def test_load_missing_template_returns_none(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    assert store.load_template("ghost") is None


def test_list_templates_empty_directory_returns_empty_list(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    assert store.list_templates() == []


def test_list_templates_sorted_by_updated_at_desc(tmp_path):
    import time

    store = PromptTemplateStore(base_dir=str(tmp_path))
    older = _template(name="Older")
    store.save_template(older)
    time.sleep(0.01)
    newer = _template(name="Newer")
    store.save_template(newer)
    listed = store.list_templates()
    assert [t.name for t in listed] == ["Newer", "Older"]


def test_list_templates_skips_corrupted_entries(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    good = _template(name="Good")
    store.save_template(good)
    (tmp_path / "corrupted.json").write_text("{not valid json", encoding="utf-8")
    listed = store.list_templates()
    assert [t.id for t in listed] == [good.id]


def test_delete_existing_and_missing_template(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    assert store.delete_template(template.id) is True
    assert store.load_template(template.id) is None
    assert store.delete_template(template.id) is False


def test_exists(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    assert store.exists(template.id) is False
    store.save_template(template)
    assert store.exists(template.id) is True


def test_save_and_load_version(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    version = _version(template.id)
    store.save_version(version)
    loaded = store.load_version(template.id, version.id)
    assert loaded is not None
    assert loaded.version == 1


def test_load_missing_version_returns_none(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    assert store.load_version(template.id, "ghost") is None


def test_list_versions_sorted_by_version_number(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    store.save_version(_version(template.id, version=2))
    store.save_version(_version(template.id, version=1))
    store.save_version(_version(template.id, version=3))
    listed = store.list_versions(template.id)
    assert [v.version for v in listed] == [1, 2, 3]


def test_list_versions_empty_when_template_has_none(tmp_path):
    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    assert store.list_versions(template.id) == []


def test_list_versions_skips_corrupted_entries(tmp_path):
    import os

    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    good = _version(template.id)
    store.save_version(good)
    versions_dir = os.path.join(str(tmp_path), template.id, "versions")
    with open(os.path.join(versions_dir, "corrupted.json"), "w", encoding="utf-8") as fh:
        fh.write("{not valid json")
    listed = store.list_versions(template.id)
    assert [v.id for v in listed] == [good.id]


def test_delete_template_removes_its_versions_too(tmp_path):
    import os

    store = PromptTemplateStore(base_dir=str(tmp_path))
    template = _template()
    store.save_template(template)
    store.save_version(_version(template.id))
    store.delete_template(template.id)
    versions_dir = os.path.join(str(tmp_path), template.id, "versions")
    assert not os.path.exists(versions_dir)


def test_load_template_raises_store_error_on_corrupted_file(tmp_path):
    template = _template()
    store = PromptTemplateStore(base_dir=str(tmp_path))
    store.save_template(template)
    path = tmp_path / f"{template.id}.json"
    path.write_text("{not valid json", encoding="utf-8")
    try:
        store.load_template(template.id)
        assert False, "expected PromptTemplateStoreError"
    except PromptTemplateStoreError:
        pass
