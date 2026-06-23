from __future__ import annotations

from app.domain.media.models import MediaCandidate
from app.domain.media.scoring import MediaRanker, RankContext


def _c(cid, provider="pexels", w=1080, h=1920, dur=5.0, tags=None, title=None, local_path=None):
    return MediaCandidate(
        id=cid, provider=provider, width=w, height=h, duration_sec=dur,
        tags=tags or [], title=title, local_path=local_path,
        download_url=None if local_path else f"https://x/{cid}.mp4",
    )


def test_rank_is_deterministic_and_sorted():
    ranker = MediaRanker()
    cands = [_c("b", tags=["calm"]), _c("a", tags=["sunrise", "calm"])]
    ctx = RankContext(query="sunrise calm", orientation="portrait", target_duration_sec=5.0)
    r1 = ranker.rank(cands, ctx)
    r2 = ranker.rank(cands, ctx)
    assert [c.id for c in r1] == [c.id for c in r2]
    # 'a' matches more query tokens -> ranks first
    assert r1[0].id == "a"
    assert r1[0].score is not None and r1[0].score_reasons


def test_filter_avoided_drops_matching():
    ranker = MediaRanker()
    cands = [_c("keep", tags=["nature"]), _c("drop", tags=["cartoon", "fun"])]
    kept = ranker.filter_avoided(cands, ["cartoon"])
    assert [c.id for c in kept] == ["keep"]


def test_prefer_local_boosts_local_candidate():
    ranker = MediaRanker()
    remote = _c("remote", provider="pexels")
    local = _c("local", provider="local", local_path="/lib/x.mp4")
    ctx_off = RankContext(
        query="", orientation="portrait", target_duration_sec=5.0, prefer_local=False
    )
    ctx_on = RankContext(
        query="", orientation="portrait", target_duration_sec=5.0, prefer_local=True
    )
    s_remote, _ = ranker.score_candidate(remote, ctx_off)
    s_local_off, _ = ranker.score_candidate(local, ctx_off)
    s_local_on, _ = ranker.score_candidate(local, ctx_on)
    assert s_local_on > s_local_off
    assert s_local_on > s_remote


def test_diversity_penalises_used_provider():
    ranker = MediaRanker()
    c = _c("x", provider="pexels")
    ctx_fresh = RankContext(query="", orientation="portrait", target_duration_sec=5.0)
    ctx_used = RankContext(
        query="", orientation="portrait", target_duration_sec=5.0, used_providers=("pexels",)
    )
    assert ranker.score_candidate(c, ctx_fresh)[0] > ranker.score_candidate(c, ctx_used)[0]


def test_missing_metadata_penalised():
    ranker = MediaRanker()
    full = _c("full", w=1080, h=1920, dur=5.0)
    bare = _c("bare", w=None, h=None, dur=None)
    ctx = RankContext(query="", orientation="portrait", target_duration_sec=5.0)
    assert ranker.score_candidate(full, ctx)[0] > ranker.score_candidate(bare, ctx)[0]
