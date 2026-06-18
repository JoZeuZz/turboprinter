"""Unit tests for the local material library (Personal Quality Stack, Fase 6).

The store (SQLite), hashing and directory scanning are stdlib only and run
end-to-end here. Media probing (duration/resolution/fps) needs ffprobe/moviepy
at runtime, so it is injected as a fake ``prober`` in these tests.
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.quality import local_library as lib
from app.services.quality import material_ranker as mr
from app.services.quality import settings as qsettings


def _fake_prober(path):
    # deterministic metadata keyed loosely on filename for variety
    name = os.path.basename(path).lower()
    if "land" in name:
        return {"duration": 8.0, "width": 1920, "height": 1080, "fps": 30.0}
    return {"duration": 6.0, "width": 1080, "height": 1920, "fps": 30.0}


def _write(path, content=b"data"):
    with open(path, "wb") as f:
        f.write(content)


class TestHashing(unittest.TestCase):
    def test_hash_is_deterministic_and_content_sensitive(self):
        with tempfile.TemporaryDirectory() as d:
            a = os.path.join(d, "a.mp4")
            b = os.path.join(d, "b.mp4")
            _write(a, b"hello world")
            _write(b, b"hello world")
            different = os.path.join(d, "c.mp4")
            _write(different, b"totally different bytes")
            self.assertEqual(lib.compute_file_hash(a), lib.compute_file_hash(b))
            self.assertNotEqual(lib.compute_file_hash(a), lib.compute_file_hash(different))


class TestStore(unittest.TestCase):
    def setUp(self):
        self.conn = lib.connect(":memory:")

    def tearDown(self):
        self.conn.close()

    def _entry(self, path="/m/a.mp4", **kw):
        base = dict(
            hash="h1",
            media_type="video",
            duration=6.0,
            width=1080,
            height=1920,
            fps=30.0,
            orientation="portrait",
            tags=["nature"],
            license="CC0",
            source="user",
            brightness=0.5,
            indexed_at="2026-06-17T00:00:00",
        )
        base.update(kw)
        return lib.LibraryEntry(path=path, **base)

    def test_upsert_and_get(self):
        lib.upsert_entry(self.conn, self._entry())
        got = lib.get_entry(self.conn, "/m/a.mp4")
        self.assertIsNotNone(got)
        self.assertEqual(got.orientation, "portrait")
        self.assertEqual(got.tags, ["nature"])
        self.assertEqual(got.license, "CC0")

    def test_upsert_is_idempotent_on_path(self):
        lib.upsert_entry(self.conn, self._entry())
        lib.upsert_entry(self.conn, self._entry(duration=9.0))
        self.assertEqual(lib.count(self.conn), 1)
        self.assertEqual(lib.get_entry(self.conn, "/m/a.mp4").duration, 9.0)

    def test_query_by_orientation_and_tag(self):
        lib.upsert_entry(self.conn, self._entry(path="/m/p.mp4", orientation="portrait"))
        lib.upsert_entry(
            self.conn,
            self._entry(path="/m/l.mp4", orientation="landscape", tags=["city"]),
        )
        portrait = lib.query_entries(self.conn, orientation="portrait")
        self.assertEqual([e.path for e in portrait], ["/m/p.mp4"])
        city = lib.query_entries(self.conn, tag="city")
        self.assertEqual([e.path for e in city], ["/m/l.mp4"])

    def test_remove_entry(self):
        lib.upsert_entry(self.conn, self._entry())
        self.assertTrue(lib.remove_entry(self.conn, "/m/a.mp4"))
        self.assertIsNone(lib.get_entry(self.conn, "/m/a.mp4"))
        self.assertFalse(lib.remove_entry(self.conn, "/m/missing.mp4"))


class TestIndexing(unittest.TestCase):
    def setUp(self):
        self.conn = lib.connect(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_index_directory_scans_media_and_stores_metadata(self):
        with tempfile.TemporaryDirectory() as d:
            _write(os.path.join(d, "portrait.mp4"))
            _write(os.path.join(d, "land_scene.mp4"))
            _write(os.path.join(d, "notes.txt"))  # ignored
            stats = lib.index_directory(self.conn, d, prober=_fake_prober, source="user")
            self.assertEqual(stats["added"], 2)
            self.assertEqual(lib.count(self.conn), 2)
            land = lib.get_entry(self.conn, os.path.join(d, "land_scene.mp4"))
            self.assertEqual(land.orientation, "landscape")
            self.assertEqual(land.width, 1920)
            self.assertEqual(land.source, "user")

    def test_reindex_unchanged_file_skips_probing(self):
        calls = []

        def counting_prober(path):
            calls.append(path)
            return _fake_prober(path)

        with tempfile.TemporaryDirectory() as d:
            _write(os.path.join(d, "portrait.mp4"))
            lib.index_directory(self.conn, d, prober=counting_prober)
            # second pass: content unchanged -> hash matches -> no re-probe
            stats = lib.index_directory(self.conn, d, prober=counting_prober)
            self.assertEqual(len(calls), 1)
            self.assertEqual(stats["skipped"], 1)

    def test_changed_file_is_reprobed_and_updated(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "portrait.mp4")
            _write(p, b"first")
            lib.index_directory(self.conn, d, prober=_fake_prober)
            _write(p, b"second, different content")
            stats = lib.index_directory(self.conn, d, prober=_fake_prober)
            self.assertEqual(stats["updated"], 1)
            self.assertEqual(lib.count(self.conn), 1)


class TestSelectPipelineMaterials(unittest.TestCase):
    def setUp(self):
        self.conn = lib.connect(":memory:")

    def tearDown(self):
        self.conn.close()

    def _ctx(self):
        return mr.RankContext(
            target_width=1080,
            target_height=1920,
            target_orientation="portrait",
            min_useful_duration=2.0,
        )

    def test_returns_ranked_local_video_paths_within_limit(self):
        with tempfile.TemporaryDirectory() as d:
            _write(os.path.join(d, "portrait.mp4"))
            _write(os.path.join(d, "land_scene.mp4"))
            lib.index_directory(self.conn, d, prober=_fake_prober)
            settings = qsettings.load_quality_settings(
                {"enabled": True, "prefer_local_assets": True}
            )
            paths = lib.select_pipeline_materials(
                self.conn, settings, self._ctx(), limit=5
            )
            self.assertTrue(all(p.endswith(".mp4") for p in paths))
            # portrait clip should rank ahead of the landscape one for a
            # portrait target
            self.assertTrue(paths[0].endswith("portrait.mp4"))

    def test_limit_is_respected(self):
        with tempfile.TemporaryDirectory() as d:
            for i in range(4):
                _write(os.path.join(d, f"clip{i}.mp4"))
            lib.index_directory(self.conn, d, prober=_fake_prober)
            settings = qsettings.load_quality_settings({"enabled": True})
            paths = lib.select_pipeline_materials(
                self.conn, settings, self._ctx(), limit=2
            )
            self.assertEqual(len(paths), 2)

    def test_empty_library_returns_empty(self):
        settings = qsettings.load_quality_settings({"enabled": True})
        self.assertEqual(
            lib.select_pipeline_materials(self.conn, settings, self._ctx(), limit=5),
            [],
        )


if __name__ == "__main__":
    unittest.main()
