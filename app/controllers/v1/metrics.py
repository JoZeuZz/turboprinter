from __future__ import annotations

from fastapi import Request

from app.application.services.metrics import ManualMetricsInput, MetricsService
from app.config import config
from app.controllers.v1.base import new_router
from app.controllers.v1.projects import _require_project_mode
from app.infrastructure.database.repositories.metrics import MetricsSnapshotRepository
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.models.exception import HttpException
from app.models.metrics_schema import ManualMetricsRequest
from app.models.project_schema import BaseProjectResponse

router = new_router()


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


def _require_publication_enabled() -> None:
    if not getattr(config, "publication_enabled", True):
        raise HttpException(task_id="", status_code=404, message="publication disabled")


def _snapshot(snapshot):
    return snapshot.model_dump(mode="json")


@router.post("/publications/{publication_id}/metrics", response_model=BaseProjectResponse)
def save_publication_metrics(request: Request, publication_id: str, body: ManualMetricsRequest):
    _require_publication_enabled()
    _require_project_mode(request)
    try:
        snapshot = MetricsService().save_manual(publication_id, ManualMetricsInput(**body.model_dump()))
    except LookupError as exc:
        raise HttpException(task_id="", status_code=404, message=str(exc)) from exc
    except ValueError as exc:
        raise HttpException(task_id="", status_code=400, message=str(exc)) from exc
    return _ok({"metrics_snapshot": _snapshot(snapshot)})


@router.get("/publications/{publication_id}/metrics", response_model=BaseProjectResponse)
def list_publication_metrics(request: Request, publication_id: str):
    _require_publication_enabled()
    _require_project_mode(request)
    if PublicationRepository().get(publication_id) is None:
        raise HttpException(task_id="", status_code=404, message="publication not found")
    metrics = MetricsSnapshotRepository().list_for_publication(publication_id)
    return _ok({"publication_id": publication_id, "metrics": [_snapshot(s) for s in metrics]})


@router.get("/workspaces/{workspace_id}/metrics/summary", response_model=BaseProjectResponse)
def workspace_metrics_summary(request: Request, workspace_id: str):
    _require_publication_enabled()
    _require_project_mode(request)
    return _ok(MetricsService().workspace_summary(workspace_id))


@router.get("/projects/{project_id}/metrics", response_model=BaseProjectResponse)
def project_metrics(request: Request, project_id: str):
    _require_publication_enabled()
    _require_project_mode(request, project_id)
    metrics = MetricsSnapshotRepository().list_for_project(project_id)
    publications = PublicationRepository().list_filtered(project_id=project_id, limit=500)
    return _ok({
        "project_id": project_id,
        "publications": [p.model_dump(mode="json") for p in publications],
        "metrics": [_snapshot(s) for s in metrics],
    })
