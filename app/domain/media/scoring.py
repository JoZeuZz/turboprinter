from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.domain.media.models import MediaCandidate

_W_QUERY = 2.0
_W_DURATION = 1.5
_W_ORIENT = 1.0
_W_RES = 1.0
_W_PREFERRED = 1.0
_W_LOCAL = 1.5
_DIVERSITY_PENALTY = 1.0
_MISSING_META_PENALTY = 0.5
_FULL_RES = 1920 * 1080


def _orientation_of(w: int | None, h: int | None) -> str:
    if not w or not h:
        return "unknown"
    if h > w:
        return "portrait"
    if w > h:
        return "landscape"
    return "square"


def _tokens(text: str) -> set[str]:
    return {t for t in re.findall(r"[\wáéíóúñü]+", text.lower()) if len(t) > 2}


@dataclass(frozen=True)
class RankContext:
    query: str = ""
    orientation: str | None = None
    target_duration_sec: float | None = None
    prefer_local: bool = False
    used_providers: tuple[str, ...] = ()
    used_ids: tuple[str, ...] = ()
    must_avoid: tuple[str, ...] = ()
    preferred_providers: tuple[str, ...] = ()


class MediaRanker:
    def score_candidate(self, cand: MediaCandidate, ctx: RankContext) -> tuple[float, list[str]]:
        score = 0.0
        reasons: list[str] = []

        # query match
        q = _tokens(ctx.query)
        if q:
            text = " ".join(cand.tags) + " " + (cand.title or "")
            matched = q & _tokens(text)
            qscore = len(matched) / len(q)
            score += _W_QUERY * qscore
            if matched:
                reasons.append(f"query+{qscore:.2f}({','.join(sorted(matched))})")

        # duration fit
        if ctx.target_duration_sec and cand.duration_sec:
            diff = abs(cand.duration_sec - ctx.target_duration_sec) / ctx.target_duration_sec
            dscore = max(0.0, 1.0 - diff)
            score += _W_DURATION * dscore
            reasons.append(f"dur{dscore:.2f}@{cand.duration_sec:.1f}s")

        # orientation
        orient = _orientation_of(cand.width, cand.height)
        if ctx.orientation:
            oscore = 1.0 if orient == ctx.orientation else (0.5 if orient == "unknown" else 0.3)
            score += _W_ORIENT * oscore
            reasons.append(f"orient{oscore:.2f}/{orient}")

        # resolution
        if cand.width and cand.height:
            rscore = min(1.0, (cand.width * cand.height) / _FULL_RES)
            score += _W_RES * rscore

        # preferred providers
        if cand.provider in ctx.preferred_providers:
            score += _W_PREFERRED
            reasons.append("preferred")

        # prefer local
        if ctx.prefer_local and cand.provider == "local":
            score += _W_LOCAL
            reasons.append("local+")

        # provider diversity penalty
        if cand.provider in ctx.used_providers:
            score -= _DIVERSITY_PENALTY
            reasons.append("diversity-")

        # missing metadata penalty
        if not (cand.width and cand.height and cand.duration_sec):
            score -= _MISSING_META_PENALTY
            reasons.append("meta-")

        return score, reasons

    def filter_avoided(self, candidates: list[MediaCandidate], must_avoid) -> list[MediaCandidate]:
        avoid = [a.lower() for a in must_avoid if a]
        if not avoid:
            return list(candidates)
        out = []
        for c in candidates:
            hay = (" ".join(c.tags) + " " + (c.title or "")).lower()
            if any(a in hay for a in avoid):
                continue
            out.append(c)
        return out

    def rank(self, candidates: list[MediaCandidate], ctx: RankContext) -> list[MediaCandidate]:
        kept = self.filter_avoided(candidates, ctx.must_avoid)
        scored: list[MediaCandidate] = []
        for c in kept:
            s, reasons = self.score_candidate(c, ctx)
            scored.append(c.model_copy(update={"score": s, "score_reasons": reasons}))
        scored.sort(key=lambda c: (-(c.score or 0.0), c.id))
        return scored
