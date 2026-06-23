from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed

from loguru import logger

from app.config import config
from app.domain.media.models import MediaCandidate
from app.domain.media.scoring import MediaRanker, RankContext
from app.domain.planning.models import ShotPlan
from app.infrastructure.media_providers.base import MediaProvider
from app.infrastructure.media_providers.local_provider import LocalLibraryProvider
from app.infrastructure.media_providers.stock_providers import (
    CoverrProvider,
    PexelsProvider,
    PixabayProvider,
)
from app.infrastructure.storage.base import ProjectStore


def _content_key(c: MediaCandidate) -> str:
    return c.download_url or c.source_url or c.local_path or c.id


class MediaAggregator:
    def __init__(
        self,
        providers: list[MediaProvider],
        ranker: MediaRanker | None = None,
        store: ProjectStore | None = None,
        max_workers: int = 4,
    ) -> None:
        self._providers = providers
        self._ranker = ranker or MediaRanker()
        self._store = store
        self._max_workers = max_workers

    @staticmethod
    def _dedupe(cands: list[MediaCandidate]) -> list[MediaCandidate]:
        seen: set[str] = set()
        out: list[MediaCandidate] = []
        for c in cands:
            key = _content_key(c)
            if key in seen:
                continue
            seen.add(key)
            out.append(c)
        return out

    @staticmethod
    def _dedupe_segment_pool(cands: list[MediaCandidate]) -> list[MediaCandidate]:
        seen: set[tuple[str | None, str]] = set()
        out: list[MediaCandidate] = []
        for c in cands:
            key = (c.segment_id, _content_key(c))
            if key in seen:
                continue
            seen.add(key)
            out.append(c)
        return out

    def search(
        self,
        query: str,
        orientation: str | None = None,
        min_duration_sec: float | None = None,
        max_results_per_provider: int = 20,
    ) -> list[MediaCandidate]:
        active = [p for p in self._providers if p.is_configured()]
        results: list[MediaCandidate] = []
        if not active:
            return results
        with ThreadPoolExecutor(max_workers=self._max_workers) as ex:
            futs = {
                ex.submit(
                    p.search_videos, query, orientation, min_duration_sec, max_results_per_provider
                ): p
                for p in active
            }
            for fut in as_completed(futs):
                p = futs[fut]
                try:
                    results.extend(fut.result())
                except Exception as exc:  # noqa: BLE001 - isolate provider failures
                    logger.warning(f"[media] provider {p.name} failed for '{query}': {exc!r}")
        return self._dedupe(results)

    def select_for_plan(
        self,
        shot_plan: ShotPlan,
        orientation: str | None = None,
        prefer_local: bool = False,
        task_id: str | None = None,
    ) -> dict[str, MediaCandidate]:
        selection: dict[str, MediaCandidate] = {}
        pool: list[MediaCandidate] = []
        used_providers: list[str] = []
        used_ids: list[str] = []

        for seg in shot_plan.segments:
            cands: list[MediaCandidate] = []
            for q in seg.search_queries:
                cands.extend(self.search(q, orientation, seg.target_duration_sec))
            if not cands:
                for q in seg.fallback_queries:
                    cands.extend(self.search(q, orientation, seg.target_duration_sec))
            cands = self._dedupe(cands)
            pool.extend(c.model_copy(update={"segment_id": seg.id}) for c in cands)

            ctx = RankContext(
                query=" ".join(seg.search_queries),
                orientation=orientation,
                target_duration_sec=seg.target_duration_sec,
                prefer_local=prefer_local,
                used_providers=tuple(used_providers),
                used_ids=tuple(used_ids),
                must_avoid=tuple(seg.must_avoid),
                preferred_providers=tuple(seg.preferred_providers),
            )
            ranked = self._ranker.rank(cands, ctx)
            best = next((c for c in ranked if c.id not in used_ids), None)
            if best is None:
                logger.warning(f"[media] no candidate for segment {seg.id}")
                continue
            chosen = best.model_copy(update={"segment_id": seg.id})
            selection[seg.id] = chosen
            used_providers.append(chosen.provider)
            used_ids.append(chosen.id)

        if self._store is not None and task_id:
            self._store.save_media_candidates(task_id, self._dedupe_segment_pool(pool))
            self._store.save_selected_media(task_id, list(selection.values()))
        return selection


def get_media_aggregator(store: ProjectStore | None = None) -> "MediaAggregator | None":
    if not getattr(config, "multi_provider_media_enabled", False):
        return None
    providers = [PexelsProvider(), PixabayProvider(), CoverrProvider(), LocalLibraryProvider()]
    return MediaAggregator([p for p in providers if p.is_configured()], store=store)
