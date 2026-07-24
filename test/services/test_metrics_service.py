from __future__ import annotations

import pytest

from app.application.services.metrics import ManualMetricsInput, MetricsProviderUnavailable, MetricsService, YouTubeAnalyticsProvider
from app.domain.operational.models import ProjectRun
from app.infrastructure.database.repositories.metrics import MetricsSnapshotRepository
from app.infrastructure.database.repositories.project_runs import ProjectRunRepository
from app.infrastructure.database.repositories.publications import PublicationRepository
from app.infrastructure.database.repositories.video_outputs import VideoOutputRepository


def _publication(project_id="project-1", workspace_id="ws-1", metadata=None):
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
        metadata=metadata or {},
    )


def test_save_manual_defaults_platform_and_external_id():
    publication = _publication()

    snapshot = MetricsService().save_manual(publication.id, ManualMetricsInput(age_window="24h", views=123))

    assert snapshot.platform == "youtube"
    assert snapshot.external_video_id == publication.external_video_id
    assert snapshot.views == 123


def test_save_manual_rejects_invalid_window():
    publication = _publication()

    with pytest.raises(ValueError, match="invalid age_window"):
        MetricsService().save_manual(publication.id, ManualMetricsInput(age_window="1h", views=1))


def test_stub_collection_is_deterministic_and_upserts():
    publication = _publication(project_id="project-2")
    service = MetricsService()

    first = service.collect_for_publication(publication, provider_name="stub", age_windows=["2h", "24h"])
    second = service.collect_for_publication(publication, provider_name="stub", age_windows=["2h", "24h"])

    assert [s.views for s in first] == [s.views for s in second]
    assert len(MetricsSnapshotRepository().list_for_publication(publication.id)) == 2


def test_workspace_summary_groups_by_publication_metadata():
    publication = _publication(metadata={"voice": "voice-a", "subtitle_style": "premium", "music_profile": "calm"})
    MetricsService().save_manual(publication.id, ManualMetricsInput(
        age_window="24h",
        views=1000,
        impressions=2000,
        ctr=0.5,
        average_view_percentage=62.5,
        likes=50,
        comments=5,
        subscribers_gained=7,
        estimated_revenue=2.5,
        rpm=2.5,
    ))

    summary = MetricsService().workspace_summary("ws-1")

    assert summary["totals"]["views"] == 1000
    assert summary["groups"]["voice"][0]["key"] == "voice-a"
    assert summary["groups"]["subtitle_style"][0]["key"] == "premium"
    assert summary["groups"]["music_profile"][0]["key"] == "calm"


def test_youtube_provider_unavailable_without_config(monkeypatch):
    from app.application.services import metrics as metrics_module

    monkeypatch.setattr(metrics_module.config, "metrics_youtube_enabled", False, raising=False)

    with pytest.raises(MetricsProviderUnavailable):
        YouTubeAnalyticsProvider().collect(_publication(), "24h")
