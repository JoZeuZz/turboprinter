from __future__ import annotations

import os

from app.config import config
from app.domain.publication.models import PublicationRequest, PublicationResult


class YouTubePublisher:
    def publish(self, publication_request: PublicationRequest) -> PublicationResult:
        if not getattr(config, "publication_youtube_enabled", False):
            return PublicationResult(success=False, error="youtube publisher disabled")
        required_envs = [
            config.publication_youtube_client_id_env,
            config.publication_youtube_client_secret_env,
            config.publication_youtube_token_env,
        ]
        missing = [name for name in required_envs if not os.getenv(name)]
        if missing:
            return PublicationResult(
                success=False,
                error=f"youtube credentials missing: {', '.join(missing)}",
            )
        return PublicationResult(
            success=False,
            error="youtube upload is not implemented in this dry-run architecture phase",
        )
