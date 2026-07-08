from __future__ import annotations

from fastapi import Request

from app.config import config
from app.controllers.v1.base import new_router
from app.domain.workspaces.models import Workspace
from app.infrastructure.storage.workspace_store import WorkspaceStore
from app.models.exception import HttpException
from app.models.project_schema import BaseProjectResponse
from app.models.workspace_schema import WorkspaceUpsertRequest

router = new_router()


def _require_workspaces_enabled() -> None:
    if not getattr(config, "workspaces_enabled", False):
        raise HttpException(task_id="", status_code=404, message="workspaces disabled")


def _validate_workspace_id(workspace_id: str) -> None:
    normalized = workspace_id.replace("\\", "/")
    parts = normalized.split("/")
    if (
        not normalized
        or normalized.startswith("/")
        or any(part in ("", ".", "..") for part in parts)
    ):
        raise HttpException(task_id="", status_code=400, message="invalid workspace id")


def _store() -> WorkspaceStore:
    return WorkspaceStore()


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


@router.get("/workspaces", response_model=BaseProjectResponse, summary="List workspaces")
def list_workspaces(request: Request):
    _require_workspaces_enabled()
    workspaces = _store().list()
    return _ok({"workspaces": [w.model_dump(mode="json") for w in workspaces]})


@router.post("/workspaces", response_model=BaseProjectResponse, summary="Create a workspace")
def create_workspace(request: Request, body: WorkspaceUpsertRequest):
    _require_workspaces_enabled()
    if not body.name.strip():
        raise HttpException(task_id="", status_code=400, message="name is required")
    workspace = Workspace(**body.model_dump())
    _store().save(workspace)
    return _ok({"workspace": workspace.model_dump(mode="json")})


@router.get("/workspaces/{workspace_id}", response_model=BaseProjectResponse, summary="Get a workspace")
def get_workspace(request: Request, workspace_id: str):
    _require_workspaces_enabled()
    _validate_workspace_id(workspace_id)
    workspace = _store().load(workspace_id)
    if workspace is None:
        raise HttpException(task_id="", status_code=404, message="workspace not found")
    return _ok({"workspace": workspace.model_dump(mode="json")})


@router.put("/workspaces/{workspace_id}", response_model=BaseProjectResponse, summary="Replace a workspace")
def update_workspace(request: Request, workspace_id: str, body: WorkspaceUpsertRequest):
    _require_workspaces_enabled()
    _validate_workspace_id(workspace_id)
    existing = _store().load(workspace_id)
    if existing is None:
        raise HttpException(task_id="", status_code=404, message="workspace not found")
    if not body.name.strip():
        raise HttpException(task_id="", status_code=400, message="name is required")
    updated = Workspace(**body.model_dump(), id=existing.id, created_at=existing.created_at)
    _store().save(updated)
    return _ok({"workspace": updated.model_dump(mode="json")})


@router.delete("/workspaces/{workspace_id}", response_model=BaseProjectResponse, summary="Delete a workspace")
def delete_workspace(request: Request, workspace_id: str):
    _require_workspaces_enabled()
    _validate_workspace_id(workspace_id)
    deleted = _store().delete(workspace_id)
    if not deleted:
        raise HttpException(task_id="", status_code=404, message="workspace not found")
    return _ok({"workspace_id": workspace_id, "deleted": True})
