from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Protocol

from pydantic import BaseModel

from app.domain.media.models import MediaCandidate

_W_VISION = 3.0


class VisionScore(BaseModel):
    relevance: float  # 0.0-1.0
    reason: str


class VisionProvider(Protocol):
    def score_thumbnail(
        self,
        thumbnail_url: str | None,
        query: str,
        narration: str,
    ) -> VisionScore | None: ...


class VisionRanker:
    def __init__(self, provider: VisionProvider, top_n: int = 3) -> None:
        self._provider = provider
        self._top_n = top_n

    def rescore_top_n(
        self,
        candidates: list[MediaCandidate],
        query: str,
        narration: str,
    ) -> list[MediaCandidate]:
        if not candidates:
            return candidates
        top = candidates[: self._top_n]
        rest = candidates[self._top_n :]

        scores: list[VisionScore | None] = [None] * len(top)
        with ThreadPoolExecutor(max_workers=max(1, len(top))) as ex:
            future_to_idx = {
                ex.submit(
                    self._provider.score_thumbnail,
                    cand.thumbnail_url,
                    query,
                    narration,
                ): i
                for i, cand in enumerate(top)
            }
            for fut in as_completed(future_to_idx):
                idx = future_to_idx[fut]
                try:
                    scores[idx] = fut.result()
                except Exception:  # noqa: BLE001
                    scores[idx] = None

        rescored: list[MediaCandidate] = []
        for i, cand in enumerate(top):
            vs = scores[i]
            if vs is not None:
                combined = (cand.score or 0.0) + _W_VISION * vs.relevance
                reasons = list(cand.score_reasons) + [
                    f"vision+{vs.relevance:.2f}:{vs.reason[:40]}"
                ]
                cand = cand.model_copy(update={"score": combined, "score_reasons": reasons})
            rescored.append(cand)

        rescored.sort(key=lambda c: -(c.score or 0.0))
        return rescored + list(rest)
