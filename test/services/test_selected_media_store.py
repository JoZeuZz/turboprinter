from __future__ import annotations

from app.domain.media.models import MediaCandidate
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


def _cand(cid: str, provider: str = "pexels") -> MediaCandidate:
    return MediaCandidate(id=cid, provider=provider, download_url=f"https://x/{cid}.mp4", segment_id="seg_001")


def test_save_load_selected_media_roundtrip(tmp_path):
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    selected = [_cand("mc-1"), _cand("mc-2", "pixabay")]
    store.save_selected_media("t1", selected)
    loaded = store.load_selected_media("t1")
    assert [c.id for c in loaded] == ["mc-1", "mc-2"]
    assert loaded[1].provider == "pixabay"


def test_load_selected_media_missing_returns_empty(tmp_path):
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    assert store.load_selected_media("ghost") == []
