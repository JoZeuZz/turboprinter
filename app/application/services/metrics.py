from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Protocol

from app.config import config
from app.domain.operational.models import AGE_WINDOWS, MetricsSnapshot
from app.domain.publication.models import Publication
from app.infrastructure.database.repositories.metrics import MetricsSnapshotRepository
from app.infrastructure.database.repositories.publications import PublicationRepository


class MetricsProviderUnavailable(RuntimeError):
    pass


@dataclass
class ManualMetricsInput:
    age_window: str
    platform: str | None = None
    external_video_id: str | None = None
    collected_at: datetime | None = None
    views: int | None = None
    impressions: int | None = None
    ctr: float | None = None
    average_view_duration: float | None = None
    average_view_percentage: float | None = None
    likes: int | None = None
    comments: int | None = None
    subscribers_gained: int | None = None
    estimated_revenue: float | None = None
    rpm: float | None = None
    metadata: dict = field(default_factory=dict)


class MetricsProvider(Protocol):
    def collect(self, publication: Publication, age_window: str) -> MetricsSnapshot:
        ...


def _validate_window(age_window: str) -> None:
    if age_window not in AGE_WINDOWS:
        raise ValueError(f"invalid age_window: {age_window}")


def _non_negative(value: int | float | None, field_name: str) -> None:
    if value is not None and value < 0:
        raise ValueError(f"{field_name} must be >= 0")


class ManualMetricsProvider:
    def __init__(self, payload: ManualMetricsInput) -> None:
        self.payload = payload

    def collect(self, publication: Publication, age_window: str) -> MetricsSnapshot:
        _validate_window(age_window)
        for field_name in (
            "views", "impressions", "ctr", "average_view_duration", "average_view_percentage",
            "likes", "comments", "subscribers_gained", "estimated_revenue", "rpm",
        ):
            _non_negative(getattr(self.payload, field_name), field_name)
        return MetricsSnapshot(
            publication_id=publication.id,
            external_video_id=self.payload.external_video_id or publication.external_video_id,
            platform=self.payload.platform or publication.platform,
            collected_at=self.payload.collected_at or datetime.now(timezone.utc),
            age_window=age_window,
            views=self.payload.views,
            impressions=self.payload.impressions,
            ctr=self.payload.ctr,
            average_view_duration=self.payload.average_view_duration,
            average_view_percentage=self.payload.average_view_percentage,
            likes=self.payload.likes,
            comments=self.payload.comments,
            subscribers_gained=self.payload.subscribers_gained,
            estimated_revenue=self.payload.estimated_revenue,
            rpm=self.payload.rpm,
            metadata=self.payload.metadata,
        )


class StubMetricsProvider:
    def collect(self, publication: Publication, age_window: str) -> MetricsSnapshot:
        _validate_window(age_window)
        seed = int(hashlib.sha256(f"{publication.id}:{age_window}".encode()).hexdigest()[:8], 16)
        views = 50 + seed % 5000
        impressions = views * 2 + seed % 3000
        likes = views // 20
        comments = views // 200
        subscribers = views // 500
        revenue = round(views * 0.0015, 4)
        return MetricsSnapshot(
            publication_id=publication.id,
            external_video_id=publication.external_video_id,
            platform=publication.platform,
            age_window=age_window,
            views=views,
            impressions=impressions,
            ctr=round(views / impressions, 4) if impressions else None,
            average_view_duration=round(12 + (seed % 45), 2),
            average_view_percentage=round(35 + (seed % 60), 2),
            likes=likes,
            comments=comments,
            subscribers_gained=subscribers,
            estimated_revenue=revenue,
            rpm=round((revenue / views) * 1000, 4) if views else None,
            metadata={"provider": "stub"},
        )


class YouTubeAnalyticsProvider:
    def collect(self, publication: Publication, age_window: str) -> MetricsSnapshot:
        _validate_window(age_window)
        if not getattr(config, "metrics_youtube_enabled", False):
            raise MetricsProviderUnavailable("youtube analytics metrics provider is not configured")
        raise MetricsProviderUnavailable("youtube analytics collection is not implemented in this phase")


def _latest_by_publication_window(snapshots: list[MetricsSnapshot]) -> list[MetricsSnapshot]:
    latest: dict[tuple[str, str, str], MetricsSnapshot] = {}
    for snapshot in snapshots:
        key = (snapshot.publication_id, snapshot.platform, snapshot.age_window)
        current = latest.get(key)
        if current is None or snapshot.collected_at >= current.collected_at:
            latest[key] = snapshot
    return list(latest.values())


def _totals(snapshots: list[MetricsSnapshot]) -> dict:
    views = sum(s.views or 0 for s in snapshots)
    impressions = sum(s.impressions or 0 for s in snapshots)
    revenue = sum(s.estimated_revenue or 0 for s in snapshots)
    rpm_values = [s.rpm for s in snapshots if s.rpm is not None]
    avp_values = [s.average_view_percentage for s in snapshots if s.average_view_percentage is not None]
    return {
        "snapshots": len(snapshots),
        "views": views,
        "impressions": impressions,
        "ctr": round(views / impressions, 4) if impressions else None,
        "average_view_percentage": round(sum(avp_values) / len(avp_values), 4) if avp_values else None,
        "likes": sum(s.likes or 0 for s in snapshots),
        "comments": sum(s.comments or 0 for s in snapshots),
        "subscribers_gained": sum(s.subscribers_gained or 0 for s in snapshots),
        "estimated_revenue": round(revenue, 4),
        "rpm": round(sum(rpm_values) / len(rpm_values), 4) if rpm_values else None,
    }


class MetricsService:
    def __init__(self, repo: MetricsSnapshotRepository | None = None, publications: PublicationRepository | None = None) -> None:
        self.repo = repo or MetricsSnapshotRepository()
        self.publications = publications or PublicationRepository()

    def save_manual(self, publication_id: str, payload: ManualMetricsInput) -> MetricsSnapshot:
        publication = self.publications.get(publication_id)
        if publication is None:
            raise LookupError("publication not found")
        snapshot = ManualMetricsProvider(payload).collect(publication, payload.age_window)
        return self.repo.upsert(snapshot)

    def _provider(self, provider_name: str) -> MetricsProvider:
        if provider_name == "stub":
            return StubMetricsProvider()
        if provider_name == "youtube":
            return YouTubeAnalyticsProvider()
        raise ValueError(f"unknown metrics provider: {provider_name}")

    def collect_for_publication(self, publication: Publication, provider_name: str, age_windows: list[str]) -> list[MetricsSnapshot]:
        provider = self._provider(provider_name)
        snapshots = []
        for age_window in age_windows:
            snapshot = provider.collect(publication, age_window)
            snapshots.append(self.repo.upsert(snapshot))
        return snapshots

    def workspace_summary(self, workspace_id: str) -> dict:
        snapshots = _latest_by_publication_window(self.repo.list_for_workspace(workspace_id))
        publications = {p.id: p for p in PublicationRepository().list_filtered(workspace_id=workspace_id, limit=500)}
        groups: dict[str, dict[str, list[MetricsSnapshot]]] = {
            "workspace": {}, "template": {}, "voice": {}, "duration": {}, "subtitle_style": {}, "music_profile": {},
        }
        for snapshot in snapshots:
            publication = publications.get(snapshot.publication_id)
            meta = publication.metadata if publication is not None else {}
            dimensions = {
                "workspace": workspace_id,
                "template": str(meta.get("prompt_template_id") or meta.get("template") or "unknown"),
                "voice": str(meta.get("voice") or meta.get("voice_name") or "unknown"),
                "duration": str(meta.get("duration_bucket") or "unknown"),
                "subtitle_style": str(meta.get("subtitle_style") or "unknown"),
                "music_profile": str(meta.get("music_profile") or "unknown"),
            }
            for group_name, key in dimensions.items():
                groups[group_name].setdefault(key, []).append(snapshot)
        return {
            "workspace_id": workspace_id,
            "totals": _totals(snapshots),
            "groups": {
                name: [{"key": key, **_totals(items)} for key, items in sorted(values.items())]
                for name, values in groups.items()
            },
            "snapshots": [s.model_dump(mode="json") for s in snapshots],
        }
