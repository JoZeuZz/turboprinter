from __future__ import annotations

from app.domain.operational.models import ProjectRun, MetricsSnapshot
from app.infrastructure.database.repositories.metrics import MetricsSnapshotRepository
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.database.repositories.video_outputs import VideoOutputRepository


def _publication(project_id="project-1", workspace_id="ws-1"):
    run = ProjectRunRepository().create(
        **ProjectRun(project_id=project_id, task_id=project_id, source="test", workspace_id=workspace_id).model_dump()
    )
    video = VideoOutputRepository().get_or_create_for_render(run.id, f"/tmp/{project_id}.mp4")
    return PublicationRepository().create(
        video_output_id=video.id,
        project_id=project_id,
        workspace_id=workspace_id,
        platform="youtube",
        external_video_id=f"yt-{project_id}",
        title="Title",
        description="Description",
        status="published",
    )


def test_metrics_repository_upserts_by_publication_platform_window():
    publication = _publication()
    repo = MetricsSnapshotRepository()

    first = repo.upsert(MetricsSnapshot(
        publication_id=publication.id,
        platform="youtube",
        external_video_id="yt-1",
        age_window="24h",
        views=100,
        metadata={"source": "manual"},
    ))
    second = repo.upsert(MetricsSnapshot(
        publication_id=publication.id,
        platform="youtube",
        external_video_id="yt-1",
        age_window="24h",
        views=250,
        likes=10,
        metadata={"source": "manual-edit"},
    ))

    listed = repo.list_for_publication(publication.id)

    assert second.id == first.id
    assert len(listed) == 1
    assert listed[0].views == 250
    assert listed[0].likes == 10
    assert listed[0].metadata == {"source": "manual-edit"}


def test_metrics_repository_lists_by_workspace_and_project():
    publication = _publication(project_id="project-2", workspace_id="ws-2")
    repo = MetricsSnapshotRepository()
    repo.upsert(MetricsSnapshot(
        publication_id=publication.id,
        platform="youtube",
        age_window="2h",
        views=50,
    ))

    assert [s.publication_id for s in repo.list_for_workspace("ws-2")] == [publication.id]
    assert [s.publication_id for s in repo.list_for_project("project-2")] == [publication.id]
