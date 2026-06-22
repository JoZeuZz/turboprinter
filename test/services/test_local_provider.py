from __future__ import annotations

from app.services.quality import local_library
from app.services.quality.local_library import LibraryEntry
from app.infrastructure.media_providers.local_provider import LocalLibraryProvider


def _seed_db(path):
    conn = local_library.connect(path)
    try:
        local_library.upsert_entry(conn, LibraryEntry(
            path="/lib/clip1.mp4", hash="h1", media_type="video",
            duration=8.0, width=1080, height=1920, orientation="portrait",
            tags=["sunrise", "calm"], license="CC0",
        ))
        local_library.upsert_entry(conn, LibraryEntry(
            path="/lib/short.mp4", hash="h2", media_type="video",
            duration=1.0, width=1080, height=1920, orientation="portrait",
        ))
    finally:
        conn.close()


def test_is_configured_false_when_no_db(tmp_path):
    provider = LocalLibraryProvider(db_path=str(tmp_path / "missing.db"))
    assert provider.is_configured() is False


def test_search_maps_entries_and_filters_duration(tmp_path):
    db = str(tmp_path / "lib.db")
    _seed_db(db)
    provider = LocalLibraryProvider(db_path=db)
    assert provider.is_configured() is True
    cands = provider.search_videos("sunrise", orientation="portrait", min_duration_sec=2.0)
    ids = {c.local_path for c in cands}
    assert "/lib/clip1.mp4" in ids
    assert "/lib/short.mp4" not in ids  # 1.0s < 2.0s filtered
    c = next(c for c in cands if c.local_path == "/lib/clip1.mp4")
    assert c.provider == "local"
    assert c.duration_sec == 8.0
    assert c.tags == ["sunrise", "calm"]
    assert c.query == "sunrise"


def test_download_is_noop(tmp_path):
    db = str(tmp_path / "lib.db")
    _seed_db(db)
    provider = LocalLibraryProvider(db_path=db)
    cand = provider.search_videos("sunrise", min_duration_sec=2.0)[0]
    assert provider.download(cand, "/whatever") is cand
