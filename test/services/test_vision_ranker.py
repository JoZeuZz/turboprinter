from __future__ import annotations

from unittest.mock import MagicMock

from app.domain.media.models import MediaCandidate
from app.domain.media.vision_scoring import VisionRanker, VisionScore


def _cand(
    cid: str,
    score: float = 0.0,
    thumbnail_url: str | None = "https://example.com/thumb.jpg",
) -> MediaCandidate:
    return MediaCandidate(
        id=cid,
        provider="pexels",
        score=score,
        score_reasons=[],
        thumbnail_url=thumbnail_url,
        download_url=f"https://x/{cid}.mp4",
    )


def test_rescore_reorders():
    """top-3 con relevancia distinta → orden cambia correctamente."""
    provider = MagicMock()
    _SCORES = {
        "https://example.com/a.jpg": VisionScore(relevance=0.2, reason="low"),   # a: 1.0 + 3.0*0.2 = 1.6
        "https://example.com/b.jpg": VisionScore(relevance=0.9, reason="high"),  # b: 0.5 + 3.0*0.9 = 3.2
        "https://example.com/c.jpg": VisionScore(relevance=0.5, reason="mid"),   # c: 0.8 + 3.0*0.5 = 2.3
    }
    provider.score_thumbnail.side_effect = lambda url, q, n: _SCORES[url]
    ranker = VisionRanker(provider, top_n=3)
    candidates = [
        _cand("a", score=1.0, thumbnail_url="https://example.com/a.jpg"),
        _cand("b", score=0.5, thumbnail_url="https://example.com/b.jpg"),
        _cand("c", score=0.8, thumbnail_url="https://example.com/c.jpg"),
    ]
    result = ranker.rescore_top_n(candidates, query="sunset", narration="golden hour scene")
    assert [c.id for c in result] == ["b", "c", "a"]


def test_rescore_no_thumbnail():
    """Candidato con thumbnail_url=None pasa sin cambio de score."""
    provider = MagicMock()
    provider.score_thumbnail.return_value = None
    ranker = VisionRanker(provider, top_n=3)
    cand = _cand("x", score=1.0, thumbnail_url=None)
    result = ranker.rescore_top_n([cand], query="q", narration="n")
    assert result[0].id == "x"
    assert result[0].score == 1.0
    assert not any("vision" in r for r in result[0].score_reasons)


def test_rescore_provider_failure():
    """Provider lanza excepción → score heurístico intacto, sin crash."""
    provider = MagicMock()
    provider.score_thumbnail.side_effect = RuntimeError("network error")
    ranker = VisionRanker(provider, top_n=3)
    cand = _cand("x", score=2.5)
    result = ranker.rescore_top_n([cand], query="q", narration="n")
    assert result[0].id == "x"
    assert result[0].score == 2.5


def test_score_blending():
    """final == heuristic + 3.0 * relevance, exacto."""
    provider = MagicMock()
    provider.score_thumbnail.return_value = VisionScore(relevance=0.7, reason="relevant")
    ranker = VisionRanker(provider, top_n=3)
    cand = _cand("x", score=1.5)
    result = ranker.rescore_top_n([cand], query="q", narration="n")
    assert abs(result[0].score - (1.5 + 3.0 * 0.7)) < 1e-9


def test_rest_untouched():
    """Candidatos más allá de top_n no pasan por visión."""
    provider = MagicMock()
    provider.score_thumbnail.return_value = VisionScore(relevance=0.5, reason="ok")
    ranker = VisionRanker(provider, top_n=2)
    cands = [
        _cand("a", score=3.0),
        _cand("b", score=2.0),
        _cand("c", score=1.0),
        _cand("d", score=0.5),
    ]
    result = ranker.rescore_top_n(cands, query="q", narration="n")
    assert provider.score_thumbnail.call_count == 2
    assert result[2].id == "c"
    assert result[2].score == 1.0
    assert result[3].id == "d"
    assert result[3].score == 0.5


def test_score_reason_appended():
    """Razón de visión aparece en score_reasons del candidato."""
    provider = MagicMock()
    provider.score_thumbnail.return_value = VisionScore(relevance=0.8, reason="shows sunset")
    ranker = VisionRanker(provider, top_n=1)
    cand = _cand("x", score=1.0)
    result = ranker.rescore_top_n([cand], query="sunset", narration="evening sky")
    reasons = result[0].score_reasons
    assert any("vision+0.80" in r for r in reasons)
    assert any("shows sunset" in r for r in reasons)


def test_empty_candidates():
    """Lista vacía no lanza excepción."""
    provider = MagicMock()
    ranker = VisionRanker(provider, top_n=3)
    result = ranker.rescore_top_n([], query="q", narration="n")
    assert result == []
    provider.score_thumbnail.assert_not_called()
