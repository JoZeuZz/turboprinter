from __future__ import annotations

from datetime import datetime, timezone

from app.domain.operational.models import ProjectRun
from app.domain.publication.models import PublicationResult
from app.infrastructure.database import schema
from app.infrastructure.database.engine import get_engine
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.database.repositories.video_outputs import VideoOutputRepository


def _project_run(project_id: str = "project-1") -> ProjectRun:
    return ProjectRun(project_id=project_id, task_id=project_id, source="test", workspace_id="ws-1")


def _insert_legacy_publication(**overrides) -> str:
    publication_id = overrides.pop("id", "legacy-pub-1")
    values = {
        "id": publication_id,
        "video_output_id": "legacy-video-1",
        "project_id": None,
        "platform": "youtube",
        "external_id": None,
        "title": "Legacy Title",
        "description": "Legacy Description",
        "status": "pending",
        "dry_run": True,
        "created_at": datetime.now(timezone.utc),
    }
    values.update(overrides)
    with get_engine().begin() as connection:
        connection.execute(schema.publications.insert().values(**values))
    return publication_id


def test_video_output_get_or_create_reuses_same_path():
    run = ProjectRunRepository().create(**_project_run().model_dump())
    repo = VideoOutputRepository()

    first = repo.get_or_create_for_render(project_run_id=run.id, file_path="/tmp/final.mp4")
    second = repo.get_or_create_for_render(project_run_id=run.id, file_path="/tmp/final.mp4")

    assert first.id == second.id
    assert first.project_run_id == run.id


def test_publication_create_get_list_and_json_fields():
    run = ProjectRunRepository().create(**_project_run().model_dump())
    video = VideoOutputRepository().get_or_create_for_render(
        project_run_id=run.id,
        file_path="/tmp/final.mp4",
    )
    repo = PublicationRepository()

    created = repo.create(
        video_output_id=video.id,
        project_id="project-1",
        workspace_id="ws-1",
        platform="youtube",
        channel_id="channel-1",
        title="Title",
        description="Description",
        tags=["tag1", "tag2"],
        metadata={"source": "content_package"},
    )

    fetched = repo.get(created.id)
    listed = repo.list_filtered(project_id="project-1", workspace_id="ws-1")

    assert fetched is not None
    assert fetched.tags == ["tag1", "tag2"]
    assert fetched.metadata == {"source": "content_package"}
    assert len(listed) == 1
    assert listed[0].id == created.id


def test_publication_get_reads_legacy_row_without_project_id():
    publication_id = _insert_legacy_publication()

    fetched = PublicationRepository().get(publication_id)

    assert fetched is not None
    assert fetched.project_id is None
    assert fetched.status == "draft"


def test_publication_list_filtered_draft_includes_legacy_pending_rows():
    publication_id = _insert_legacy_publication()

    listed = PublicationRepository().list_filtered(status="draft")

    assert [publication.id for publication in listed] == [publication_id]
    assert listed[0].status == "draft"


def test_publication_status_transitions():
    run = ProjectRunRepository().create(**_project_run().model_dump())
    video = VideoOutputRepository().get_or_create_for_render(run.id, "/tmp/final.mp4")
    repo = PublicationRepository()
    created = repo.create(
        video_output_id=video.id,
        project_id="project-1",
        platform="youtube",
        title="Title",
        description="Description",
    )

    publishing = repo.mark_publishing(created.id)
    published = repo.mark_published(
        created.id,
        PublicationResult(
            success=True,
            external_video_id="dry-run:pub",
            published_at=datetime.now(timezone.utc),
            metadata={"dry_run": True},
        ),
    )
    failed = repo.mark_failed(created.id, "boom")

    assert publishing is not None and publishing.status == "publishing"
    assert published is not None and published.status == "published"
    assert published.external_video_id == "dry-run:pub"
    assert failed is not None and failed.status == "failed"
    assert failed.error == "boom"
