from __future__ import annotations

import pytest

from app.application.services.reddit_ingest import (
    RedditIngestService,
    RedditThreadNormalizer,
    get_reddit_ingest_service,
)
from app.domain.sources.models import StorySource


def test_anonymize_replaces_usernames():
    norm = RedditThreadNormalizer()
    out = norm.anonymize("Thanks u/john_doe and /u/Jane for the help")
    assert "u/john_doe" not in out
    assert "Jane" not in out
    assert out.count("usuario") == 2


def test_to_script_text_joins_title_body_comments():
    norm = RedditThreadNormalizer()
    source = StorySource(
        id="t3_1", title="My Title", body="Body text by u/op.",
        comments=["First by u/a", "Second"],
    )
    script = norm.to_script_text(source)
    assert script.startswith("My Title")
    assert "Body text" in script
    assert "u/op" not in script
    assert "First" in script and "Second" in script


def test_from_manual_builds_anonymized_source():
    svc = RedditIngestService()
    source = svc.from_manual(title="T", body="hi u/bob", comments=["c1 by u/ann"])
    assert source.kind == "manual"
    assert "u/bob" not in source.body
    assert "u/ann" not in source.comments[0]


def test_fetch_uses_injected_client():
    class FakeSubmission:
        id = "abc"
        title = "Fake Title"
        selftext = "Story by u/op"
        subreddit = "tales"

        class comments:
            @staticmethod
            def list():
                class _C:
                    body = "comment by u/x"
                return [_C()]

    class FakeClient:
        def submission(self, url=None, id=None):
            return FakeSubmission()

    svc = RedditIngestService()
    source = svc.fetch("https://reddit.com/r/tales/abc", client=FakeClient())
    assert source.id == "abc"
    assert source.title == "Fake Title"
    assert "u/op" not in source.body
    assert source.comments and "u/x" not in source.comments[0]


def test_fetch_without_client_or_praw_raises(monkeypatch):
    svc = RedditIngestService()
    monkeypatch.setattr(
        svc, "_build_client", lambda: (_ for _ in ()).throw(RuntimeError("no praw"))
    )
    with pytest.raises(RuntimeError):
        svc.fetch("https://reddit.com/r/x/abc")


def test_get_reddit_ingest_service_gated(monkeypatch):
    from app.application.services import reddit_ingest as ri
    monkeypatch.setattr(ri.config, "reddit_ingest_enabled", False)
    assert get_reddit_ingest_service() is None
    monkeypatch.setattr(ri.config, "reddit_ingest_enabled", True)
    assert isinstance(get_reddit_ingest_service(), RedditIngestService)
