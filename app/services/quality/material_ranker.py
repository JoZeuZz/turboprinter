"""Deterministic material ranker for the optional Personal Quality Stack.

Ranks candidate clips/images by cheap, deterministic signals — resolution,
orientation fit, useful duration, local/licensed preference, optional darkness
and an optional semantic ``embedding_score`` — and orders the result with
query-level diversity so a single search term cannot monopolise the timeline.

Pure/stdlib only (no network/moviepy/app.config) so it is fully unit testable.
Heavier signals (brightness, embeddings) are *optional* candidate fields: when
absent they are simply skipped, so no heavy dependency is required now. The
local material library (Fase 6) can populate brightness; a future semantic
stage can populate ``embedding_score`` without changing this interface.
"""

from dataclasses import dataclass
from typing import List, Optional

# Scoring weights (higher = better). Tuned so resolution and orientation
# dominate, duration matters, and preferences/semantics nudge ties.
_W_RESOLUTION = 2.0
_W_ORIENTATION = 2.0
_W_DURATION = 1.5
_W_LOCAL = 1.0
_W_LICENSE = 0.3
_W_DARK_PENALTY = 2.0
_W_EMBEDDING = 2.0

_DARK_THRESHOLD = 0.15  # brightness below this is considered "too dark"


@dataclass
class MaterialCandidate:
    key: str  # stable identity (url or local path) for cache/dedupe
    provider: str = ""
    query: str = ""  # the search term that surfaced this candidate
    duration: float = 0.0
    width: int = 0
    height: int = 0
    fps: float = 0.0
    is_local: bool = False
    license: Optional[str] = None
    brightness: Optional[float] = None  # 0..1, optional
    embedding_score: Optional[float] = None  # 0..1 semantic relevance, optional


@dataclass(frozen=True)
class RankContext:
    target_width: int
    target_height: int
    target_orientation: str  # "portrait" | "landscape" | "square"
    min_useful_duration: float = 2.0


# --- module-level score cache, keyed by candidate + settings + context ---
_score_cache: dict = {}


def clear_cache() -> None:
    _score_cache.clear()


def cache_size() -> int:
    return len(_score_cache)


def _orientation_of(width: int, height: int) -> str:
    if width <= 0 or height <= 0:
        return "unknown"
    if height > width:
        return "portrait"
    if width > height:
        return "landscape"
    return "square"


def _resolution_score(candidate: MaterialCandidate, context: RankContext) -> float:
    if candidate.width <= 0 or candidate.height <= 0:
        return 0.5  # unknown resolution: neutral, never fatal
    target_pixels = max(1, context.target_width * context.target_height)
    ratio = (candidate.width * candidate.height) / target_pixels
    return max(0.0, min(1.0, ratio))


def _orientation_score(candidate: MaterialCandidate, context: RankContext) -> float:
    orientation = _orientation_of(candidate.width, candidate.height)
    if orientation == "unknown":
        return 0.5
    if orientation == context.target_orientation:
        return 1.0
    if orientation == "square" or context.target_orientation == "square":
        return 0.6  # square crops/letterboxes acceptably either way
    return 0.2  # opposite orientation: heavy crop/letterbox


def _duration_score(candidate: MaterialCandidate, context: RankContext) -> float:
    if candidate.duration <= 0:
        return 0.5
    full_at = max(0.1, context.min_useful_duration * 2.0)
    return max(0.0, min(1.0, candidate.duration / full_at))


def _settings_fingerprint(settings) -> tuple:
    return (
        bool(getattr(settings, "prefer_local_assets", False)),
        bool(getattr(settings, "prefer_licensed_assets", False)),
    )


def _cache_key(candidate: MaterialCandidate, settings, context: RankContext) -> tuple:
    return (
        candidate.key,
        candidate.duration,
        candidate.width,
        candidate.height,
        candidate.is_local,
        candidate.license is not None,
        candidate.brightness,
        candidate.embedding_score,
        _settings_fingerprint(settings),
        (context.target_width, context.target_height, context.target_orientation,
         context.min_useful_duration),
    )


def _compute_score(candidate: MaterialCandidate, settings, context: RankContext) -> float:
    score = 0.0
    score += _W_RESOLUTION * _resolution_score(candidate, context)
    score += _W_ORIENTATION * _orientation_score(candidate, context)
    score += _W_DURATION * _duration_score(candidate, context)

    if candidate.is_local and getattr(settings, "prefer_local_assets", False):
        score += _W_LOCAL
    if candidate.license and getattr(settings, "prefer_licensed_assets", False):
        score += _W_LICENSE
    if candidate.brightness is not None and candidate.brightness < _DARK_THRESHOLD:
        deficit = (_DARK_THRESHOLD - candidate.brightness) / _DARK_THRESHOLD
        score -= _W_DARK_PENALTY * deficit
    if candidate.embedding_score is not None:
        score += _W_EMBEDDING * float(candidate.embedding_score)
    return score


def score_candidate(candidate: MaterialCandidate, settings, context: RankContext) -> float:
    """Deterministic score for a candidate (cached by identity + inputs)."""
    cache_key = _cache_key(candidate, settings, context)
    cached = _score_cache.get(cache_key)
    if cached is not None:
        return cached
    score = _compute_score(candidate, settings, context)
    _score_cache[cache_key] = score
    return score


def explain(candidate: MaterialCandidate, settings, context: RankContext) -> str:
    """Human-readable reason string for debug logging (why this clip ranks)."""
    return (
        f"{candidate.key} [{candidate.provider}/{candidate.query}] "
        f"score={score_candidate(candidate, settings, context):.3f} "
        f"(res={_resolution_score(candidate, context):.2f}, "
        f"orient={_orientation_score(candidate, context):.2f}/"
        f"{_orientation_of(candidate.width, candidate.height)}, "
        f"dur={_duration_score(candidate, context):.2f}@{candidate.duration:.1f}s, "
        f"local={candidate.is_local}, "
        f"emb={candidate.embedding_score})"
    )


def rank_candidates(
    candidates: List[MaterialCandidate],
    settings,
    context: RankContext,
    debug: bool = False,
) -> List[MaterialCandidate]:
    """Return all candidates ordered by score with query-level diversity.

    Candidates are scored, grouped by query (each group sorted by score desc,
    then key asc for determinism), and interleaved round-robin across groups
    (groups ordered by their best score). This favours high-quality clips while
    preventing one search term from dominating the start of the timeline. No
    candidate is dropped.
    """
    if not candidates:
        return []

    scored = [(score_candidate(c, settings, context), c) for c in candidates]
    if debug:
        for _, c in sorted(scored, key=lambda t: (-t[0], t[1].key)):
            print(explain(c, settings, context))  # pragma: no cover

    groups: dict = {}
    for score, candidate in scored:
        groups.setdefault(candidate.query, []).append((score, candidate))
    for query in groups:
        groups[query].sort(key=lambda t: (-t[0], t[1].key))

    # order groups by their best score (desc), then query name (asc) for ties
    ordered_queries = sorted(
        groups.keys(), key=lambda q: (-groups[q][0][0], q)
    )

    result: List[MaterialCandidate] = []
    index = 0
    remaining = sum(len(v) for v in groups.values())
    while remaining > 0:
        for query in ordered_queries:
            group = groups[query]
            if index < len(group):
                result.append(group[index][1])
                remaining -= 1
        index += 1
    return result
