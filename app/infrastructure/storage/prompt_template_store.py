from __future__ import annotations

import logging
import os
import shutil

from pydantic import ValidationError

from app.domain.prompts.models import PromptTemplate, PromptVersion

logger = logging.getLogger(__name__)


class PromptTemplateStoreError(Exception):
    def __init__(self, path: str, cause: Exception) -> None:
        self.path = path
        self.cause = cause
        super().__init__(f"PromptTemplateStore error at {path}: {cause}")


class PromptTemplateStore:
    def __init__(self, base_dir: str | None = None) -> None:
        self._base = base_dir

    def _dir(self, *, make: bool = False) -> str:
        if self._base is not None:
            path = self._base
        else:
            from app.utils import utils

            path = utils.storage_dir("prompt_templates")
        if make and not os.path.exists(path):
            os.makedirs(path)
        return path

    def _template_path(self, template_id: str, *, make: bool = False) -> str:
        return os.path.join(self._dir(make=make), f"{template_id}.json")

    def _versions_dir(self, template_id: str, *, make: bool = False) -> str:
        path = os.path.join(self._dir(), template_id, "versions")
        if make and not os.path.exists(path):
            os.makedirs(path)
        return path

    def _version_path(self, template_id: str, version_id: str, *, make: bool = False) -> str:
        return os.path.join(self._versions_dir(template_id, make=make), f"{version_id}.json")

    # -- templates ---------------------------------------------------

    def save_template(self, template: PromptTemplate) -> None:
        path = self._template_path(template.id, make=True)
        try:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(template.model_dump_json(indent=2))
        except OSError as exc:
            raise PromptTemplateStoreError(path, exc) from exc

    def load_template(self, template_id: str) -> PromptTemplate | None:
        path = self._template_path(template_id)
        if not os.path.isfile(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = fh.read()
        except OSError as exc:
            raise PromptTemplateStoreError(path, exc) from exc
        try:
            return PromptTemplate.model_validate_json(raw)
        except ValidationError as exc:
            raise PromptTemplateStoreError(path, exc) from exc

    def list_templates(self) -> list[PromptTemplate]:
        directory = self._dir()
        if not os.path.isdir(directory):
            return []
        templates: list[PromptTemplate] = []
        for name in sorted(os.listdir(directory)):
            if not name.endswith(".json"):
                continue
            template_id = name[: -len(".json")]
            try:
                template = self.load_template(template_id)
            except PromptTemplateStoreError as exc:
                logger.warning("list_templates: skipping %s — %s", name, exc)
                continue
            if template is not None:
                templates.append(template)
        templates.sort(key=lambda t: t.updated_at, reverse=True)
        return templates

    def delete_template(self, template_id: str) -> bool:
        path = self._template_path(template_id)
        if not os.path.isfile(path):
            return False
        os.remove(path)
        versions_dir = self._versions_dir(template_id)
        if os.path.isdir(versions_dir):
            shutil.rmtree(versions_dir)
        return True

    def exists(self, template_id: str) -> bool:
        return os.path.isfile(self._template_path(template_id))

    # -- versions ------------------------------------------------------

    def save_version(self, version: PromptVersion) -> None:
        path = self._version_path(version.template_id, version.id, make=True)
        try:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(version.model_dump_json(indent=2))
        except OSError as exc:
            raise PromptTemplateStoreError(path, exc) from exc

    def load_version(self, template_id: str, version_id: str) -> PromptVersion | None:
        path = self._version_path(template_id, version_id)
        if not os.path.isfile(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = fh.read()
        except OSError as exc:
            raise PromptTemplateStoreError(path, exc) from exc
        try:
            return PromptVersion.model_validate_json(raw)
        except ValidationError as exc:
            raise PromptTemplateStoreError(path, exc) from exc

    def list_versions(self, template_id: str) -> list[PromptVersion]:
        directory = self._versions_dir(template_id)
        if not os.path.isdir(directory):
            return []
        versions: list[PromptVersion] = []
        for name in sorted(os.listdir(directory)):
            if not name.endswith(".json"):
                continue
            version_id = name[: -len(".json")]
            try:
                version = self.load_version(template_id, version_id)
            except PromptTemplateStoreError as exc:
                logger.warning("list_versions: skipping %s — %s", name, exc)
                continue
            if version is not None:
                versions.append(version)
        versions.sort(key=lambda v: v.version)
        return versions
