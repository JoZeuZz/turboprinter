"""Unit tests for the deterministic material ranker (Personal Quality Stack).

Pure/stdlib only: no network, moviepy or app.config. Ranking is deterministic so
it can be fully exercised here.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.quality import material_ranker as mr
from app.services.quality import settings as qsettings

PORTRAIT_CTX = mr.RankContext(
    target_width=1080,
    target_height=1920,
    target_orientation="portrait",
    min_useful_duration=2.0,
)


def _settings(**over):
    cfg = {"enabled": True}
    cfg.update(over)
    return qsettings.load_quality_settings(cfg)


def _cand(key, **kw):
    base = dict(
        provider="pexels", query="q", duration=5.0, width=1080, height=1920
    )
    base.update(kw)
    return mr.MaterialCandidate(key=key, **base)


class TestScoring(unittest.TestCase):
    def setUp(self):
        mr.clear_cache()

    def test_higher_resolution_scores_higher(self):
        low = _cand("low", width=540, height=960)
        high = _cand("high", width=1080, height=1920)
        s = _settings()
        self.assertGreater(
            mr.score_candidate(high, s, PORTRAIT_CTX),
            mr.score_candidate(low, s, PORTRAIT_CTX),
        )

    def test_matching_orientation_scores_higher(self):
        portrait = _cand("p", width=1080, height=1920)
        landscape = _cand("l", width=1920, height=1080)
        s = _settings()
        self.assertGreater(
            mr.score_candidate(portrait, s, PORTRAIT_CTX),
            mr.score_candidate(landscape, s, PORTRAIT_CTX),
        )

    def test_longer_useful_clip_scores_higher_than_too_short(self):
        short = _cand("s", duration=1.0)
        longer = _cand("l", duration=5.0)
        s = _settings()
        self.assertGreater(
            mr.score_candidate(longer, s, PORTRAIT_CTX),
            mr.score_candidate(short, s, PORTRAIT_CTX),
        )

    def test_local_preference_boosts_local_candidate(self):
        local = _cand("loc", is_local=True)
        remote = _cand("rem", is_local=False)
        s = _settings(prefer_local_assets=True)
        self.assertGreater(
            mr.score_candidate(local, s, PORTRAIT_CTX),
            mr.score_candidate(remote, s, PORTRAIT_CTX),
        )

    def test_local_preference_disabled_gives_no_local_bonus(self):
        local = _cand("loc", is_local=True)
        remote = _cand("rem", is_local=False)
        s = _settings(prefer_local_assets=False)
        self.assertEqual(
            mr.score_candidate(local, s, PORTRAIT_CTX),
            mr.score_candidate(remote, s, PORTRAIT_CTX),
        )

    def test_embedding_score_increases_score(self):
        without = _cand("a")
        withemb = _cand("a", embedding_score=0.9)
        s = _settings()
        self.assertGreater(
            mr.score_candidate(withemb, s, PORTRAIT_CTX),
            mr.score_candidate(without, s, PORTRAIT_CTX),
        )

    def test_dark_clip_is_penalized(self):
        dark = _cand("d", brightness=0.05)
        bright = _cand("b", brightness=0.8)
        s = _settings()
        self.assertLess(
            mr.score_candidate(dark, s, PORTRAIT_CTX),
            mr.score_candidate(bright, s, PORTRAIT_CTX),
        )

    def test_unknown_resolution_is_neutral_not_fatal(self):
        unknown = _cand("u", width=0, height=0)
        s = _settings()
        # should not raise and should produce a finite score
        score = mr.score_candidate(unknown, s, PORTRAIT_CTX)
        self.assertIsInstance(score, float)


class TestRanking(unittest.TestCase):
    def setUp(self):
        mr.clear_cache()

    def test_ranking_preserves_all_candidates(self):
        cands = [_cand(f"k{i}") for i in range(5)]
        ranked = mr.rank_candidates(cands, _settings(), PORTRAIT_CTX)
        self.assertEqual(len(ranked), 5)
        self.assertEqual({c.key for c in ranked}, {c.key for c in cands})

    def test_ranking_is_deterministic(self):
        cands = [
            _cand("a", query="A", width=540, height=960),
            _cand("b", query="B", width=1080, height=1920),
            _cand("c", query="A", width=720, height=1280),
        ]
        first = [c.key for c in mr.rank_candidates(cands, _settings(), PORTRAIT_CTX)]
        second = [c.key for c in mr.rank_candidates(cands, _settings(), PORTRAIT_CTX)]
        self.assertEqual(first, second)

    def test_diversity_does_not_let_one_query_monopolize_top(self):
        cands = [
            _cand("a1", query="A"),
            _cand("a2", query="A"),
            _cand("a3", query="A"),
            _cand("b1", query="B"),
        ]
        ranked = mr.rank_candidates(cands, _settings(), PORTRAIT_CTX)
        top_two_queries = {ranked[0].query, ranked[1].query}
        self.assertIn("B", top_two_queries)

    def test_explain_mentions_key_factors(self):
        text = mr.explain(_cand("x"), _settings(), PORTRAIT_CTX)
        self.assertIn("res", text.lower())
        self.assertIn("orient", text.lower())


class TestCache(unittest.TestCase):
    def test_score_is_cached_and_clearable(self):
        mr.clear_cache()
        c = _cand("k")
        s = _settings()
        mr.score_candidate(c, s, PORTRAIT_CTX)
        mr.score_candidate(c, s, PORTRAIT_CTX)
        self.assertEqual(mr.cache_size(), 1)
        mr.clear_cache()
        self.assertEqual(mr.cache_size(), 0)


if __name__ == "__main__":
    unittest.main()
