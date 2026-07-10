from __future__ import annotations

from fastapi import Request

from app.application.services.publication_service import DraftPublicationInput, PublicationService
from app.config import config
from app.controllers.v1.base import new_router
from app.controllers.v1.projects import _require_project_mode
from app.domain.publication.models import Publication
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.models.exception import HttpException
from app.models.project_schema import BaseProjectResponse
from app.models.publication_schema import DraftPublicationRequest, PublishPublicationRequest

router = new_router()


def _ok(data) -> BaseProjectResponse:
    return BaseProjectResponse(data=data)


def _require_publication_enabled() -> None:
    if not getattr(config, "publication_enabled", True):
        raise HttpException(task_id="", status_code=404, message="publication disabled")


def _publication_to_dict(publication: Publication) -> dict:
    return publication.model_dump(mode="json")


def _service() -> PublicationService:
    return PublicationService(store=FilesystemProjectStore())


@router.post("/projects/{project_id}/publication/draft", response_model=BaseProjectResponse)
def create_publication_draft(request: Request, project_id: str, body: DraftPublicationRequest):
    _require_publication_enabled()
    _require_project_mode(request, project_id)
    try:
        publication = _service().create_draft(
            project_id,
            DraftPublicationInput(
                platform=body.platform,
                channel_id=body.channel_id,
                title=body.title,
                description=body.description,
                tags=body.tags,
                thumbnail_path=body.thumbnail_path,
                privacy_status=body.privacy_status,
                scheduled_at=body.scheduled_at,
                dry_run=body.dry_run,
            ),
        )
    except ValueError as exc:
        raise HttpException(task_id=project_id, status_code=400, message=str(exc)) from exc
    return _ok({"publication": _publication_to_dict(publication)})


@router.post("/publications/{publication_id}/publish", response_model=BaseProjectResponse)
def publish_publication(request: Request, publication_id: str, body: PublishPublicationRequest | None = None):
    _require_publication_enabled()
    _require_project_mode(request)
    body = body or PublishPublicationRequest()
    try:
        publication = _service().publish(publication_id, dry_run=body.dry_run)
    except LookupError as exc:
        raise HttpException(task_id="", status_code=404, message=str(exc)) from exc
    except ValueError as exc:
        raise HttpException(task_id="", status_code=400, message=str(exc)) from exc
    return _ok({"publication": _publication_to_dict(publication)})


@router.get("/publications", response_model=BaseProjectResponse)
def list_publications(
    request: Request,
    project_id: str | None = None,
    workspace_id: str | None = None,
    platform: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    _require_publication_enabled()
    _require_project_mode(request)
    publications = PublicationRepository().list_filtered(
        project_id=project_id,
        workspace_id=workspace_id,
        platform=platform,
        status=status,
        limit=limit,
        offset=offset,
    )
    return _ok({"publications": [_publication_to_dict(pub) for pub in publications]})


@router.get("/publications/{publication_id}", response_model=BaseProjectResponse)
def get_publication(request: Request, publication_id: str):
    _require_publication_enabled()
    _require_project_mode(request)
    publication = PublicationRepository().get(publication_id)
    if publication is None:
        raise HttpException(task_id="", status_code=404, message="publication not found")
    return _ok({"publication": _publication_to_dict(publication)})
