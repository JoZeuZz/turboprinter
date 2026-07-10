from __future__ import annotations

from datetime import datetime, timezone

from app.domain.publication.models import PublicationRequest, PublicationResult


class DryRunPublisher:
    def publish(self, publication_request: PublicationRequest) -> PublicationResult:
        if not publication_request.title.strip():
            return PublicationResult(success=False, error="title is required")
        if not publication_request.video_path.strip():
            return PublicationResult(success=False, error="video path is required")
        return PublicationResult(
            success=True,
            external_video_id=f"dry-run:{publication_request.publication_id}",
            published_at=datetime.now(timezone.utc),
            metadata={
                **publication_request.metadata,
                "dry_run": True,
                "platform": publication_request.platform,
                "video_path": publication_request.video_path,
            },
        )
