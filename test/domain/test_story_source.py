from __future__ import annotations

from app.domain.sources.models import StorySource


def test_story_source_minimal_and_roundtrip():
    source = StorySource(
        id="t3_abc", kind="reddit", url="https://reddit.com/r/x/abc",
        subreddit="x", title="A story", body="Once upon a time.",
        comments=["nice", "wow"],
    )
    assert source.kind == "reddit"
    assert source.author_anonymized is True
    assert source.fetched_at is not None
    dumped = StorySource.model_validate_json(source.model_dump_json())
    assert dumped.comments == ["nice", "wow"]
