from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PromptTemplateCreateRequest(BaseModel):
    name: str
    content_type: str
    language: str = "es"
    system_prompt: str
    user_prompt_template: str
    expected_schema: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class PromptTemplateUpdateRequest(BaseModel):
    name: str
    content_type: str
    language: str = "es"
    metadata: dict[str, Any] = Field(default_factory=dict)


class PromptVersionCreateRequest(BaseModel):
    system_prompt: str
    user_prompt_template: str
    expected_schema: dict[str, Any] | None = None
    model_hint: str | None = None
    change_notes: str | None = None


class ActivateVersionRequest(BaseModel):
    version_id: str
