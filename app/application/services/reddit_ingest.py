from __future__ import annotations

import itertools
import re

from app.config import config
from app.domain.sources.models import StorySource

_USERNAME_RE = re.compile(r"/?u/[A-Za-z0-9_\-]+")


class RedditThreadNormalizer:
    def anonymize(self, text: str) -> str:
        counter = itertools.count(1)
        return _USERNAME_RE.sub(lambda _m: f"usuario{next(counter)}", text)

    def to_script_text(self, source: StorySource) -> str:
        parts: list[str] = []
        if source.title:
            parts.append(source.title.strip())
        if source.body:
            parts.append(source.body.strip())
        parts.extend(c.strip() for c in source.comments if c.strip())
        joined = "\n\n".join(p for p in parts if p)
        return self.anonymize(joined)


class RedditIngestService:
    def __init__(self, normalizer: RedditThreadNormalizer | None = None) -> None:
        self._norm = normalizer or RedditThreadNormalizer()

    def from_manual(self, title: str, body: str, comments: list[str] | None = None) -> StorySource:
        comments = comments or []
        return StorySource(
            id="manual", kind="manual", title=title,
            body=self._norm.anonymize(body),
            comments=[self._norm.anonymize(c) for c in comments],
            license_note="user-provided text",
        )

    def _build_client(self):
        # Lazy import: PRAW is optional. Requires reddit creds in config.app.
        import praw  # noqa: F401

        app_cfg = getattr(config, "app", {})
        client_id = app_cfg.get("reddit_client_id", "")
        client_secret = app_cfg.get("reddit_client_secret", "")
        user_agent = app_cfg.get("reddit_user_agent", "turboprinter")
        if not client_id or not client_secret:
            raise RuntimeError("reddit credentials missing in config.app")
        return praw.Reddit(
            client_id=client_id, client_secret=client_secret, user_agent=user_agent
        )

    def fetch(self, url_or_id: str, client=None) -> StorySource:
        client = client or self._build_client()
        if url_or_id.startswith("http"):
            submission = client.submission(url=url_or_id)
        else:
            submission = client.submission(id=url_or_id)
        comments = []
        try:
            comments = [c.body for c in submission.comments.list() if getattr(c, "body", None)]
        except Exception:  # noqa: BLE001 - comments optional / rate limits
            comments = []
        return StorySource(
            id=submission.id, kind="reddit", url=url_or_id,
            subreddit=str(getattr(submission, "subreddit", "")) or None,
            title=getattr(submission, "title", None),
            body=self._norm.anonymize(getattr(submission, "selftext", "") or ""),
            comments=[self._norm.anonymize(c) for c in comments],
            license_note="reddit content; review usage rights before publishing",
        )


def get_reddit_ingest_service() -> "RedditIngestService | None":
    if not getattr(config, "reddit_ingest_enabled", False):
        return None
    return RedditIngestService()
