from __future__ import annotations

import json
import os

import pytest

from app.application.services.publication_service import DraftPublicationInput, PublicationService
from app.domain.operational.models import ProjectRun
from app.domain.publication.models import Publication
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


def _store_with_render(tmp_path, project_id="project-1") -> FilesystemProjectStore:
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    store.save_script(project_id, "Primera frase del guion. Segunda frase.")
    store.save_project_metadata(project_id, topic="Tema Test", workspace_id="ws-1")
    store.save_render_result(
        project_id,
        type("RenderResultLike", (), {
            "model_dump_json": lambda self, indent=2: json.dumps({
                "project_id": project_id,
                "output_path": os.path.join(str(tmp_path), project_id, "final.mp4"),
                "renderer_used": "moviepy",
                "success": True,
                "error": None,
            }, indent=indent)
        })(),
    )
    return store


def _register_run(project_id="project-1"):
    return ProjectRunRepository().create(
        **ProjectRun(project_id=project_id, task_id=project_id, source="test", workspace_id="ws-1").model_dump()
    )


def test_dry_run_publisher_never_needs_credentials():
    from app.domain.publication.models import PublicationRequest
    from app.infrastructure.publishers.dry_run import DryRunPublisher

    result = DryRunPublisher().publish(
        PublicationRequest(
            publication_id="pub-1",
            video_path="/tmp/final.mp4",
            platform="youtube",
            title="Title",
            description="Description",
            dry_run=True,
        )
    )

    assert result.success is True
    assert result.external_video_id == "dry-run:pub-1"
    assert result.metadata["dry_run"] is True


def test_youtube_publisher_fails_while_disabled():
    from app.domain.publication.models import PublicationRequest
    from app.infrastructure.publishers.youtube import YouTubePublisher

    result = YouTubePublisher().publish(
        PublicationRequest(
            publication_id="pub-1",
            video_path="/tmp/final.mp4",
            platform="youtube",
            title="Title",
            dry_run=False,
        )
    )

    assert result.success is False
    assert result.error == "youtube publisher disabled"


def test_create_draft_uses_manual_metadata_and_render_output(tmp_path):
    store = _store_with_render(tmp_path)
    _register_run()
    service = PublicationService(store=store)

    pub = service.create_draft(
        "project-1",
        DraftPublicationInput(
            title="Manual title",
            description="Manual description",
            tags=["a", "b"],
            channel_id="channel-1",
        ),
    )

    assert pub.title == "Manual title"
    assert pub.description == "Manual description"
    assert pub.tags == ["a", "b"]
    assert pub.status == "draft"
    assert pub.dry_run is True
    assert pub.workspace_id == "ws-1"
    assert pub.metadata["source"] == "manual"
    assert store.load_project_metadata("project-1")["publication_metadata"]["publication_id"] == pub.id


def test_create_draft_uses_content_package_source_when_not_manual(tmp_path):
    store = _store_with_render(tmp_path)
    _register_run()
    with open(os.path.join(store.project_dir("project-1"), "content_package.json"), "w", encoding="utf-8") as fh:
        json.dump(
            {
                "title": "Package title",
                "description": "Package description",
                "hashtags": ["package", "shorts"],
            },
            fh,
        )
    service = PublicationService(store=store)

    pub = service.create_draft("project-1", DraftPublicationInput())

    assert pub.title == "Package title"
    assert pub.description == "Package description"
    assert pub.tags == ["package", "shorts"]
    assert pub.metadata["source"] == "content_package"


def test_create_draft_fails_without_render_result(tmp_path):
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    store.save_script("project-1", "Guion.")
    _register_run()
    service = PublicationService(store=store)

    with pytest.raises(ValueError, match="render required"):
        service.create_draft("project-1", DraftPublicationInput(title="Title"))


@pytest.mark.parametrize("thumbnail_path", ["/tmp/thumbnail.jpg", "../thumbnail.jpg", "safe/../thumbnail.jpg"])
def test_create_draft_rejects_unsafe_thumbnail_path(tmp_path, thumbnail_path):
    store = _store_with_render(tmp_path)
    _register_run()
    service = PublicationService(store=store)

    with pytest.raises(ValueError, match="thumbnail_path"):
        service.create_draft("project-1", DraftPublicationInput(title="Title", thumbnail_path=thumbnail_path))


def test_publish_dry_run_updates_publication(tmp_path):
    store = _store_with_render(tmp_path)
    _register_run()
    service = PublicationService(store=store)
    draft = service.create_draft("project-1", DraftPublicationInput(title="Title"))

    published = service.publish(draft.id, dry_run=True)

    assert published.status == "published"
    assert published.external_video_id == f"dry-run:{draft.id}"
    assert published.published_at is not None
    assert published.metadata["source"] == "manual"
    assert published.metadata["video_path"]
    assert published.metadata["dry_run"] is True


def test_publish_marks_failed_when_publisher_raises(tmp_path, monkeypatch):
    from app.infrastructure.publishers.dry_run import DryRunPublisher

    store = _store_with_render(tmp_path)
    _register_run()
    service = PublicationService(store=store)
    draft = service.create_draft("project-1", DraftPublicationInput(title="Title"))

    def boom(self, publication_request):
        raise RuntimeError("publisher boom")

    monkeypatch.setattr(DryRunPublisher, "publish", boom)

    failed = service.publish(draft.id, dry_run=True)

    assert failed.status == "failed"
    assert failed.error == "publisher boom"
    assert service.publications.get(draft.id).status == "failed"


def test_publish_skips_project_metadata_when_publication_has_no_project_id(tmp_path):
    calls = []

    class FakeStore:
        def save_publication_metadata(self, task_id, publication_metadata):
            calls.append((task_id, publication_metadata))

    publications = PublicationRepository()
    publication = publications.create(
        **Publication(
            video_output_id="vo-legacy",
            project_id=None,
            title="Legacy",
            metadata={"video_path": str(tmp_path / "final.mp4")},
        ).model_dump()
    )
    service = PublicationService(store=FakeStore(), publications=publications)

    published = service.publish(publication.id, dry_run=True)

    assert published.status == "published"
    assert calls == []


def test_publish_unsupported_platform_does_not_leave_publishing(tmp_path):
    store = _store_with_render(tmp_path)
    _register_run()
    service = PublicationService(store=store)
    draft = service.create_draft(
        "project-1",
        DraftPublicationInput(title="Title", platform="unsupported", dry_run=False),
    )

    with pytest.raises(ValueError, match="unsupported publication platform"):
        service.publish(draft.id)

    assert service.publications.get(draft.id).status == "draft"
