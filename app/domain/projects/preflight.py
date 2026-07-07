from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PreflightCheck(BaseModel):
    id: str
    passed: bool
    severity: Literal["error", "warning"]
    message: str


class PreflightResult(BaseModel):
    project_id: str
    valid: bool
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    summary: str
    checks: list[PreflightCheck] = Field(default_factory=list)
