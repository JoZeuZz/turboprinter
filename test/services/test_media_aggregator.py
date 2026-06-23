from __future__ import annotations

from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan, ShotSegment
import app.application.services.media_aggregator as ma


class FakeProvider:
    def __init__(self, name, results, configured=True, raises=False):
        self.name = name
        self._results = results
        self._configured = configured
        self._raises = raises

    def is_configured(self):
        return self._configured

    def search_videos(self, query, orientation=None, min_duration_sec=None, max_results=20):
        if self._raises:
            raise RuntimeError("provider boom")
        return [c.model_copy(update={"query": query}) for c in self._results]

    def download(self, candidate, target_dir):
        return candidate


def _c(cid, provider, url=None, local_path=None, tags=None, dur=5.0):
    return MediaCandidate(
        id=cid, provider=provider, duration_sec=dur, width=1080, height=1920,
        tags=tags or [], local_path=local_path,
        download_url=url or (None if local_path else f"https://x/{cid}.mp4"),
    )


def test_search_aggregates_configured_providers_in_parallel():
    agg = ma.MediaAggregator([
        FakeProvider("pexels", [_c("p1", "pexels")]),
        FakeProvider("pixabay", [_c("x1", "pixabay")]),
    ])
    cands = agg.search("sunrise")
    assert {c.id for c in cands} == {"p1", "x1"}


def test_search_isolates_failing_provider():
    agg = ma.MediaAggregator([
        FakeProvider("pexels", [_c("p1", "pexels")]),
        FakeProvider("broken", [], raises=True),
    ])
    cands = agg.search("q")
    assert {c.id for c in cands} == {"p1"}


def test_search_skips_unconfigured_provider():
    agg = ma.MediaAggregator([
        FakeProvider("pexels", [_c("p1", "pexels")]),
        FakeProvider("off", [_c("o1", "off")], configured=False),
    ])
    assert {c.id for c in agg.search("q")} == {"p1"}


def test_search_dedupes_by_content_key():
    dup = _c("a", "pexels", url="https://same/v.mp4")
    dup2 = _c("b", "pixabay", url="https://same/v.mp4")
    agg = ma.MediaAggregator([
        FakeProvider("pexels", [dup]),
        FakeProvider("pixabay", [dup2]),
    ])
    cands = agg.search("q")
    assert len(cands) == 1


def _plan():
    return ShotPlan(
        language="es", script="s",
        segments=[
            ShotSegment(id="seg_001", order=1, narration_text="a", target_duration_sec=5.0,
                        visual_goal="g", search_queries=["sunrise"]),
            ShotSegment(id="seg_002", order=2, narration_text="b", target_duration_sec=5.0,
                        visual_goal="g", search_queries=["ocean"]),
        ],
    )


def test_select_for_plan_picks_one_per_segment_with_diversity():
    agg = ma.MediaAggregator([
        FakeProvider("pexels", [_c("p1", "pexels", tags=["sunrise"]),
                                _c("p2", "pexels", tags=["ocean"])]),
        FakeProvider("pixabay", [_c("x1", "pixabay", tags=["sunrise"]),
                                 _c("x2", "pixabay", tags=["ocean"])]),
    ])
    sel = agg.select_for_plan(_plan(), orientation="portrait")
    assert set(sel.keys()) == {"seg_001", "seg_002"}
    # diversity: two segments should not both pick the same provider when alternatives exist
    assert sel["seg_001"].provider != sel["seg_002"].provider
    assert sel["seg_001"].segment_id == "seg_001"


def test_select_for_plan_uses_fallback_queries():
    seg = ShotSegment(id="seg_001", order=1, narration_text="a", target_duration_sec=5.0,
                      visual_goal="g", search_queries=["primary"], fallback_queries=["backup"])
    plan = ShotPlan(language="es", script="s", segments=[seg])

    class QueryAwareProvider:
        name = "pexels"
        def is_configured(self): return True
        def search_videos(self, query, orientation=None, min_duration_sec=None, max_results=20):
            if query == "primary":
                return []
            return [_c("fb", "pexels", tags=["backup"]).model_copy(update={"query": query})]
        def download(self, c, d): return c

    sel = ma.MediaAggregator([QueryAwareProvider()]).select_for_plan(plan)
    assert sel["seg_001"].id == "fb"
    assert sel["seg_001"].query == "backup"


def test_select_for_plan_persists(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    agg = ma.MediaAggregator(
        [FakeProvider("pexels", [_c("p1", "pexels", tags=["sunrise"])])], store=store
    )
    agg.select_for_plan(_plan(), task_id="t1")
    assert store.load_selected_media("t1")  # non-empty
    assert store.load_media_candidates("t1")  # pool persisted


def test_select_for_plan_persists_segment_scoped_candidate_pool(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    agg = ma.MediaAggregator([
        FakeProvider("pexels", [
            _c("shared", "pexels", url="https://x/shared.mp4", tags=["sunrise", "ocean"]),
        ])
    ], store=store)

    agg.select_for_plan(_plan(), task_id="t1")

    persisted = store.load_media_candidates("t1")
    assert [candidate.segment_id for candidate in persisted] == ["seg_001", "seg_002"]


def test_factory_returns_none_when_flag_off(monkeypatch):
    monkeypatch.setattr(ma.config, "multi_provider_media_enabled", False, raising=False)
    assert ma.get_media_aggregator() is None
