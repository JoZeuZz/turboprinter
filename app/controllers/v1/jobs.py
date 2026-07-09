from __future__ import annotations

import json
from datetime import datetime, timezone

from fastapi import Request

from app.application.services.project_lifecycle import create_project
from app.config import config
from app.controllers.v1.base import new_router
from app.controllers.v1.projects import _register_project_run
from app.domain.operational.models import Job
from app.infrastructure.database.repositories.jobs import JobRepository
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.models.exception import HttpException
from app.models.job_schema import JOB_TYPES, JobCreateRequest, RunFullPipelineRequest
from app.models.project_schema import BaseProjectResponse
from app.services import llm

router = new_router()


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


def _require_jobs_enabled() -> None:
    if not getattr(config, "jobs_enabled", False):
        raise HttpException(task_id="", status_code=404, message="jobs disabled")


def _job_to_dict(job: Job) -> dict:
    data = job.model_dump(mode="json")
    data["payload"] = json.loads(job.payload_json)
    del data["payload_json"]
    return data


@router.post("/jobs", response_model=BaseProjectResponse, summary="Create a job")
def create_job(request: Request, body: JobCreateRequest):
    _require_jobs_enabled()
    if body.type not in JOB_TYPES:
        raise HttpException(task_id="", status_code=400, message=f"unknown job type: {body.type}")
    job = JobRepository().create(
        type=body.type,
        workspace_id=body.workspace_id,
        project_id=body.project_id,
        payload_json=json.dumps(body.payload),
        scheduled_at=body.scheduled_at or datetime.now(timezone.utc),
        max_attempts=body.max_attempts,
    )
    return _ok({"job": _job_to_dict(job)})


@router.get("/jobs", response_model=BaseProjectResponse, summary="List jobs")
def list_jobs(
    request: Request,
    status: str | None = None,
    type: str | None = None,
    workspace_id: str | None = None,
    project_id: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    _require_jobs_enabled()
    jobs = JobRepository().list_filtered(
        status=status, type=type, workspace_id=workspace_id, project_id=project_id,
        limit=limit, offset=offset,
    )
    return _ok({"jobs": [_job_to_dict(j) for j in jobs]})


@router.get("/jobs/{job_id}", response_model=BaseProjectResponse, summary="Get a job")
def get_job(request: Request, job_id: str):
    _require_jobs_enabled()
    job = JobRepository().get(job_id)
    if job is None:
        raise HttpException(task_id="", status_code=404, message="job not found")
    return _ok({"job": _job_to_dict(job)})


@router.post(
    "/jobs/{job_id}/cancel", response_model=BaseProjectResponse, summary="Cancel a pending job"
)
def cancel_job(request: Request, job_id: str):
    _require_jobs_enabled()
    repo = JobRepository()
    existing = repo.get(job_id)
    if existing is None:
        raise HttpException(task_id="", status_code=404, message="job not found")
    cancelled = repo.cancel(job_id)
    if cancelled is None:
        raise HttpException(
            task_id="", status_code=409,
            message=f"cannot cancel job in status {existing.status!r}",
        )
    return _ok({"job": _job_to_dict(cancelled)})


@router.post(
    "/workspaces/{workspace_id}/run-full-pipeline",
    response_model=BaseProjectResponse,
    summary="Enqueue the full project pipeline",
)
def run_full_pipeline(request: Request, workspace_id: str, body: RunFullPipelineRequest):
    _require_jobs_enabled()
    store = FilesystemProjectStore()
    project_id = body.project_id
    if project_id:
        if not store.exists(project_id):
            raise HttpException(task_id=project_id, status_code=404, message="project not found")
    else:
        if not body.topic and not body.script:
            raise HttpException(
                task_id="", status_code=400, message="project_id or topic/script is required",
            )
        script = body.script
        if not script and body.topic:
            script = llm.generate_script(video_subject=body.topic, language=body.language)
        project_id = create_project(
            store, topic=body.topic, script=script, workspace_id=workspace_id,
        )
        _register_project_run(
            task_id=project_id, workspace_id=workspace_id, source="pipeline", topic=body.topic,
            prompt_template_id=None, prompt_version_id=None,
        )
    payload = {
        "language": body.language,
        "voice_name": body.voice_name,
        "voice_rate": body.voice_rate,
        "subtitle_enabled": body.subtitle_enabled,
        "visual_style": body.visual_style,
        "orientation": body.orientation,
        "allow_preflight_warnings": body.allow_preflight_warnings,
    }
    job = JobRepository().create(
        type="full_project_pipeline",
        workspace_id=workspace_id,
        project_id=project_id,
        payload_json=json.dumps(payload),
        scheduled_at=body.scheduled_at or datetime.now(timezone.utc),
    )
    return _ok({"job_id": job.id, "project_id": project_id})
