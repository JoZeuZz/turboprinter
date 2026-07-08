# app/application/services/prompt_templates.py
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.domain.prompts.models import PromptTemplate, PromptVersion
from app.infrastructure.storage.prompt_template_store import PromptTemplateStore


class PromptTemplateError(Exception):
    pass


class PromptTemplateService:
    def __init__(self, store: PromptTemplateStore | None = None) -> None:
        self._store = store or PromptTemplateStore()

    def create_template(
        self,
        *,
        name: str,
        content_type: str,
        language: str,
        system_prompt: str,
        user_prompt_template: str,
        expected_schema: dict[str, Any] | None,
        metadata: dict[str, Any],
    ) -> PromptTemplate:
        template = PromptTemplate(
            name=name,
            content_type=content_type,
            language=language,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
            expected_schema=expected_schema,
            metadata=metadata,
        )
        version = PromptVersion(
            template_id=template.id,
            version=1,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
            expected_schema=expected_schema,
            active=True,
        )
        template.active_version_id = version.id
        self._store.save_template(template)
        self._store.save_version(version)
        return template

    def add_version(
        self,
        template_id: str,
        *,
        system_prompt: str,
        user_prompt_template: str,
        expected_schema: dict[str, Any] | None,
        model_hint: str | None,
        change_notes: str | None,
    ) -> PromptVersion:
        template = self._store.load_template(template_id)
        if template is None:
            raise PromptTemplateError("template not found")
        existing_versions = self._store.list_versions(template_id)
        next_number = max((v.version for v in existing_versions), default=0) + 1
        version = PromptVersion(
            template_id=template_id,
            version=next_number,
            system_prompt=system_prompt,
            user_prompt_template=user_prompt_template,
            expected_schema=expected_schema,
            model_hint=model_hint,
            change_notes=change_notes,
            active=False,
        )
        self._store.save_version(version)
        return version

    def activate_version(self, template_id: str, version_id: str) -> PromptTemplate:
        template = self._store.load_template(template_id)
        if template is None:
            raise PromptTemplateError("template not found")
        target = self._store.load_version(template_id, version_id)
        if target is None:
            raise PromptTemplateError("version not found")
        for version in self._store.list_versions(template_id):
            if version.active and version.id != version_id:
                version.active = False
                self._store.save_version(version)
        target.active = True
        self._store.save_version(target)
        template.active_version_id = target.id
        template.system_prompt = target.system_prompt
        template.user_prompt_template = target.user_prompt_template
        template.expected_schema = target.expected_schema
        template.updated_at = datetime.now(timezone.utc)
        self._store.save_template(template)
        return template
