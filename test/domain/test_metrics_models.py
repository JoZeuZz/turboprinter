from __future__ import annotations

from app.domain.operational.models import AGE_WINDOWS, MetricsSnapshot


def test_metrics_snapshot_defaults_and_metadata():
    snapshot = MetricsSnapshot(publication_id="pub-1", platform="youtube", age_window="24h")

    assert snapshot.id
    assert snapshot.publication_id == "pub-1"
    assert snapshot.platform == "youtube"
    assert snapshot.age_window == "24h"
    assert snapshot.metadata == {}
    assert snapshot.collected_at.tzinfo is not None


def test_age_windows_are_canonical_order():
    assert AGE_WINDOWS == ("2h", "6h", "24h", "48h", "7d", "28d")
