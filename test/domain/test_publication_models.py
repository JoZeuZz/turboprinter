from __future__ import annotations

from app.domain.publication.models import Publication, PublicationRequest, PublicationResult


def test_publication_defaults_are_safe():
    pub = Publication(
        video_output_id="vo-1",
        project_id="project-1",
        platform="youtube",
        title="Title",
        description="Description",
    )

    assert pub.status == "draft"
    assert pub.privacy_status == "private"
    assert pub.dry_run is True
    assert pub.tags == []
    assert pub.metadata == {}


def test_publication_request_carries_video_path_and_metadata():
    req = PublicationRequest(
        publication_id="pub-1",
        video_path="/tmp/final.mp4",
        platform="youtube",
        channel_id="channel-1",
        title="Title",
        description="Description",
        tags=["one", "two"],
        privacy_status="private",
        dry_run=True,
        metadata={"source": "test"},
    )

    assert req.publication_id == "pub-1"
    assert req.tags == ["one", "two"]
    assert req.metadata["source"] == "test"


def test_publication_result_defaults_to_no_error():
    result = PublicationResult(success=True, external_video_id="dry-run:pub-1")

    assert result.success is True
    assert result.error is None
    assert result.metadata == {}
