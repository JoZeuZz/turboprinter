from __future__ import annotations

import json

from app.domain.operational.models import Job, ProjectRun
from app.infrastructure.database.repositories.metrics import MetricsSnapshotRepository
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.database.repositories.video_outputs import VideoOutputRepository
from app.workers.handlers import handle_collect_metrics


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


def test_collect_metrics_job_with_stub_for_publication():
    publication = _publication()
    job = Job(type="collect_metrics", payload_json=json.dumps({
        "publication_id": publication.id,
        "provider": "stub",
        "age_windows": ["2h", "24h"],
    }))

    handle_collect_metrics(job)

    snapshots = MetricsSnapshotRepository().list_for_publication(publication.id)
    assert [s.age_window for s in snapshots] == ["2h", "24h"]
    assert all(s.views is not None for s in snapshots)
