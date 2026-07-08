from __future__ import annotations

from datetime import datetime, timezone

from fastapi import Request

from app.application.services.prompt_templates import PromptTemplateError, PromptTemplateService
from app.config import config
from app.controllers.v1.base import new_router
from app.infrastructure.storage.prompt_template_store import PromptTemplateStore
from app.models.exception import HttpException
from app.models.project_schema import BaseProjectResponse
from app.models.prompt_schema import (
    ActivateVersionRequest,
    PromptTemplateCreateRequest,
    PromptTemplateUpdateRequest,
    PromptVersionCreateRequest,
)

router = new_router()


def _require_prompt_templates_enabled() -> None:
    if not getattr(config, "prompt_templates_enabled", False):
        raise HttpException(task_id="", status_code=404, message="prompt templates disabled")


def _validate_template_id(template_id: str) -> None:
    normalized = template_id.replace("\\", "/")
    parts = normalized.split("/")
    if (
        not normalized
        or normalized.startswith("/")
        or any(part in ("", ".", "..") for part in parts)
    ):
        raise HttpException(task_id="", status_code=400, message="invalid template id")


def _store() -> PromptTemplateStore:
    return PromptTemplateStore()


def _service() -> PromptTemplateService:
    return PromptTemplateService(_store())


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


@router.get("/prompt-templates", response_model=BaseProjectResponse, summary="List prompt templates")
def list_prompt_templates(request: Request):
    _require_prompt_templates_enabled()
    templates = _store().list_templates()
    return _ok({"templates": [t.model_dump(mode="json") for t in templates]})


@router.post("/prompt-templates", response_model=BaseProjectResponse, summary="Create a prompt template")
def create_prompt_template(request: Request, body: PromptTemplateCreateRequest):
    _require_prompt_templates_enabled()
    if not body.name.strip():
        raise HttpException(task_id="", status_code=400, message="name is required")
    template = _service().create_template(
        name=body.name,
        content_type=body.content_type,
        language=body.language,
        system_prompt=body.system_prompt,
        user_prompt_template=body.user_prompt_template,
        expected_schema=body.expected_schema,
        metadata=body.metadata,
    )
    return _ok({"template": template.model_dump(mode="json")})


@router.get("/prompt-templates/{template_id}", response_model=BaseProjectResponse, summary="Get a prompt template")
def get_prompt_template(request: Request, template_id: str):
    _require_prompt_templates_enabled()
    _validate_template_id(template_id)
    template = _store().load_template(template_id)
    if template is None:
        raise HttpException(task_id="", status_code=404, message="template not found")
    return _ok({"template": template.model_dump(mode="json")})


@router.put("/prompt-templates/{template_id}", response_model=BaseProjectResponse, summary="Update a prompt template")
def update_prompt_template(request: Request, template_id: str, body: PromptTemplateUpdateRequest):
    _require_prompt_templates_enabled()
    _validate_template_id(template_id)
    existing = _store().load_template(template_id)
    if existing is None:
        raise HttpException(task_id="", status_code=404, message="template not found")
    if not body.name.strip():
        raise HttpException(task_id="", status_code=400, message="name is required")
    existing.name = body.name
    existing.content_type = body.content_type
    existing.language = body.language
    existing.metadata = body.metadata
    existing.updated_at = datetime.now(timezone.utc)
    _store().save_template(existing)
    return _ok({"template": existing.model_dump(mode="json")})


@router.post(
    "/prompt-templates/{template_id}/versions",
    response_model=BaseProjectResponse,
    summary="Create a new prompt version",
)
def create_prompt_version(request: Request, template_id: str, body: PromptVersionCreateRequest):
    _require_prompt_templates_enabled()
    _validate_template_id(template_id)
    try:
        version = _service().add_version(
            template_id,
            system_prompt=body.system_prompt,
            user_prompt_template=body.user_prompt_template,
            expected_schema=body.expected_schema,
            model_hint=body.model_hint,
            change_notes=body.change_notes,
        )
    except PromptTemplateError as exc:
        raise HttpException(task_id="", status_code=404, message=str(exc)) from exc
    return _ok({"version": version.model_dump(mode="json")})


@router.get(
    "/prompt-templates/{template_id}/versions",
    response_model=BaseProjectResponse,
    summary="List versions of a prompt template",
)
def list_prompt_versions(request: Request, template_id: str):
    _require_prompt_templates_enabled()
    _validate_template_id(template_id)
    if not _store().exists(template_id):
        raise HttpException(task_id="", status_code=404, message="template not found")
    versions = _store().list_versions(template_id)
    return _ok({"versions": [v.model_dump(mode="json") for v in versions]})


@router.post(
    "/prompt-templates/{template_id}/activate-version",
    response_model=BaseProjectResponse,
    summary="Activate a prompt version",
)
def activate_prompt_version(request: Request, template_id: str, body: ActivateVersionRequest):
    _require_prompt_templates_enabled()
    _validate_template_id(template_id)
    try:
        template = _service().activate_version(template_id, body.version_id)
    except PromptTemplateError as exc:
        raise HttpException(task_id="", status_code=404, message=str(exc)) from exc
    return _ok({"template": template.model_dump(mode="json")})
