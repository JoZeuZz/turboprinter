from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import PurePosixPath, PureWindowsPath

from app.config import config
from app.domain.publication.models import Publication, PublicationRequest
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.database.repositories.video_outputs import VideoOutputRepository
from app.infrastructure.publishers.dry_run import DryRunPublisher
from app.infrastructure.publishers.youtube import YouTubePublisher
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@dataclass
class DraftPublicationInput:
    platform: str | None = None
    channel_id: str | None = None
    title: str | None = None
    description: str | None = None
    tags: list[str] = field(default_factory=list)
    thumbnail_path: str | None = None
    privacy_status: str | None = None
    scheduled_at: datetime | None = None
    dry_run: bool | None = None


class PublicationService:
    def __init__(
        self,
        *,
        store: FilesystemProjectStore | None = None,
        publications: PublicationRepository | None = None,
        video_outputs: VideoOutputRepository | None = None,
    ) -> None:
        self.store = store or FilesystemProjectStore()
        self.publications = publications or PublicationRepository()
        self.video_outputs = video_outputs or VideoOutputRepository()

    def _render_output_path(self, project_id: str) -> str:
        result = self.store.load_render_result(project_id)
        if result is None or not result.success or not result.output_path:
            raise ValueError("render required before publication draft")
        return result.output_path

    def _content_package(self, project_id: str) -> dict:
        path = os.path.join(self.store.project_dir(project_id), "content_package.json")
        if not os.path.isfile(path):
            return {}
        try:
            with open(path, encoding="utf-8") as fh:
                return json.load(fh)
        except (OSError, ValueError):
            return {}

    def _fallback_metadata(self, project_id: str) -> dict:
        project_meta = self.store.load_project_metadata(project_id) or {}
        timeline = self.store.load_timeline(project_id)
        shot_plan = self.store.load_shot_plan(project_id)
        script = self.store.load_script(project_id) or ""
        script_lines = script.splitlines()
        title = (
            project_meta.get("topic")
            or (timeline.title if timeline is not None else None)
            or (shot_plan.topic if shot_plan is not None else None)
            or (script_lines[0][:80] if script_lines else "")
            or project_id
        )
        return {"title": title, "description": script[:500], "tags": [], "source": "fallback"}

    def _draft_metadata(self, project_id: str, draft: DraftPublicationInput) -> dict:
        package = self._content_package(project_id)
        fallback = self._fallback_metadata(project_id)
        title = draft.title or package.get("title") or fallback["title"]
        description = draft.description or package.get("description") or fallback["description"]
        tags = draft.tags or package.get("hashtags") or fallback["tags"]
        manual_source = bool(draft.title or draft.description or draft.tags)
        package_source = bool(package.get("title") or package.get("description") or package.get("hashtags"))
        return {
            "source": "manual" if manual_source else "content_package" if package_source else fallback["source"],
            "title": title,
            "description": description,
            "tags": [str(tag).strip() for tag in tags if str(tag).strip()],
            "content_package": package,
        }

    def _safe_thumbnail_path(self, thumbnail_path: str | None) -> str | None:
        if thumbnail_path is None:
            return None
        value = thumbnail_path.strip()
        if not value:
            return None
        posix_path = PurePosixPath(value)
        windows_path = PureWindowsPath(value)
        if (
            posix_path.is_absolute()
            or windows_path.is_absolute()
            or ".." in posix_path.parts
            or ".." in windows_path.parts
        ):
            raise ValueError("thumbnail_path must be a relative project path")
        return value

    def _save_publication_metadata(self, publication: Publication) -> None:
        if not publication.project_id:
            return
        self.store.save_publication_metadata(
            publication.project_id,
            {
                "publication_id": publication.id,
                "title": publication.title,
                "description": publication.description,
                "tags": publication.tags,
                "status": publication.status,
                "external_video_id": publication.external_video_id,
                "error": publication.error,
            },
        )

    def create_draft(self, project_id: str, draft: DraftPublicationInput) -> Publication:
        render_path = self._render_output_path(project_id)
        project_run = ProjectRunRepository().get_by_project_id(project_id)
        if project_run is None:
            raise ValueError("project run required before publication draft")
        video_output = self.video_outputs.get_or_create_for_render(project_run.id, render_path)
        metadata = self._draft_metadata(project_id, draft)
        thumbnail_path = self._safe_thumbnail_path(draft.thumbnail_path)
        publication = self.publications.create(
            video_output_id=video_output.id,
            project_id=project_id,
            workspace_id=project_run.workspace_id,
            platform=draft.platform or getattr(config, "publication_default_platform", "youtube"),
            channel_id=draft.channel_id,
            title=metadata["title"],
            description=metadata["description"],
            tags=metadata["tags"],
            thumbnail_path=thumbnail_path,
            privacy_status=draft.privacy_status or "private",
            scheduled_at=draft.scheduled_at,
            dry_run=getattr(config, "publication_default_dry_run", True) if draft.dry_run is None else draft.dry_run,
            metadata={**metadata, "video_path": render_path},
        )
        self.store.save_publication_metadata(
            project_id,
            {
                "publication_id": publication.id,
                "title": publication.title,
                "description": publication.description,
                "tags": publication.tags,
                "status": publication.status,
            },
        )
        return publication

    def _publisher(self, publication: Publication, dry_run: bool):
        if dry_run:
            return DryRunPublisher()
        if publication.platform == "youtube":
            return YouTubePublisher()
        raise ValueError(f"unsupported publication platform: {publication.platform}")

    def publish(self, publication_id: str, dry_run: bool | None = None) -> Publication:
        publication = self.publications.get(publication_id)
        if publication is None:
            raise LookupError("publication not found")
        effective_dry_run = publication.dry_run if dry_run is None else dry_run
        video_path = publication.metadata.get("video_path") or ""
        request = PublicationRequest(
            publication_id=publication.id,
            video_path=video_path,
            platform=publication.platform,
            channel_id=publication.channel_id,
            title=publication.title,
            description=publication.description,
            tags=publication.tags,
            thumbnail_path=publication.thumbnail_path,
            privacy_status=publication.privacy_status,
            scheduled_at=publication.scheduled_at,
            dry_run=effective_dry_run,
            metadata=publication.metadata,
        )
        publisher = self._publisher(publication, effective_dry_run)
        self.publications.mark_publishing(publication_id)
        try:
            result = publisher.publish(request)
        except Exception as exc:
            updated = self.publications.mark_failed(publication_id, str(exc))
            if updated is None:
                raise LookupError("publication not found") from exc
            self._save_publication_metadata(updated)
            return updated
        if result.success:
            updated = self.publications.mark_published(publication_id, result)
        else:
            updated = self.publications.mark_failed(publication_id, result.error or "publication failed")
        if updated is None:
            raise LookupError("publication not found")
        self._save_publication_metadata(updated)
        return updated
