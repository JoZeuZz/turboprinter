from __future__ import annotations

import os

from fastapi import Request

from app.config import config
from app.controllers import base
from app.controllers.v1.base import new_router
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.models.exception import HttpException
from app.models.project_schema import (
    BaseProjectResponse,
    CreateFromScriptRequest,
    CreateFromTopicRequest,
)
from app.services import llm
from app.utils import utils

router = new_router()


def _store() -> FilesystemProjectStore:
    return FilesystemProjectStore()


def _require_project_mode(request: Request) -> str:
    if not getattr(config, "project_mode_enabled", False):
        raise HttpException(
            task_id="", status_code=404, message="project mode disabled"
        )
    return base.get_task_id(request)


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


@router.post("/projects/from-topic", response_model=BaseProjectResponse,
             summary="Create a project from a topic")
def create_from_topic(request: Request, body: CreateFromTopicRequest):
    _require_project_mode(request)
    task_id = utils.get_uuid()
    store = _store()
    script = ""
    if body.generate_script:
        script = llm.generate_script(
            video_subject=body.topic, language=body.language,
            paragraph_number=body.paragraph_number,
        )
    store.save_script(task_id, script)
    return _ok({"project_id": task_id, "has_script": bool(script)})


@router.post("/projects/from-script", response_model=BaseProjectResponse,
             summary="Create a project from a pasted script")
def create_from_script(request: Request, body: CreateFromScriptRequest):
    _require_project_mode(request)
    if not body.script.strip():
        raise HttpException(task_id="", status_code=400, message="script is empty")
    task_id = utils.get_uuid()
    _store().save_script(task_id, body.script)
    return _ok({"project_id": task_id, "has_script": True})


@router.get("/projects/{project_id}", response_model=BaseProjectResponse,
            summary="Get project state")
def get_project(request: Request, project_id: str):
    _require_project_mode(request)
    store = _store()
    if not store.exists(project_id):
        raise HttpException(task_id=project_id, status_code=404, message="project not found")
    return _ok({
        "project_id": project_id,
        "has_script": store.load_script(project_id) is not None,
        "has_shot_plan": store.load_shot_plan(project_id) is not None,
        "has_selected_media": bool(store.load_selected_media(project_id)),
        "has_timeline": store.load_timeline(project_id) is not None,
    })
