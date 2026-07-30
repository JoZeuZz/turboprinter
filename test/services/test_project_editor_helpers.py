"""Tests for pure helper functions in 2_Project_Editor.py."""
from __future__ import annotations

import importlib.util
import os
import sys

import pytest


def _load_editor():
    spec = importlib.util.spec_from_file_location(
        "project_editor",
        os.path.join(os.path.dirname(__file__), "../../webui/pages/2_Project_Editor.py"),
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules.setdefault("streamlit", _StreamlitStub())
    spec.loader.exec_module(mod)
    return mod


class _StreamlitStub:
    """Minimal stub so the module-level import of streamlit doesn't fail."""
    def __getattr__(self, name):
        return lambda *a, **kw: None

    def runtime(self):
        return self

    def exists(self):
        return False


_mod = _load_editor()
_gantt_data = _mod._gantt_data
_list_local_songs = _mod._list_local_songs


# ---------------------------------------------------------------------------
# _gantt_data
# ---------------------------------------------------------------------------

_TRACK_A = {
    "id": "video-1",
    "type": "video",
    "items": [
        {"id": "item-1", "start_sec": 0.0, "duration_sec": 5.0, "segment_id": "seg-1"},
        {"id": "item-2", "start_sec": 5.0, "duration_sec": 3.0, "segment_id": "seg-2"},
    ],
}

_TRACK_B = {
    "id": "video-2",
    "type": "video",
    "items": [
        {"id": "item-3", "start_sec": 0.0, "duration_sec": 8.0, "segment_id": "seg-3"},
    ],
}


def test_gantt_data_row_count():
    rows = _gantt_data([_TRACK_A, _TRACK_B])
    assert len(rows) == 3


def test_gantt_data_start_end_arithmetic():
    rows = _gantt_data([_TRACK_A])
    assert rows[0] == {"name": "item-1", "start": 0.0, "end": 5.0, "segment_id": "seg-1"}
    assert rows[1] == {"name": "item-2", "start": 5.0, "end": 8.0, "segment_id": "seg-2"}


def test_gantt_data_segment_id_passthrough():
    rows = _gantt_data([_TRACK_B])
    assert rows[0]["segment_id"] == "seg-3"


def test_gantt_data_empty_tracks():
    assert _gantt_data([]) == []


def test_gantt_data_empty_items():
    rows = _gantt_data([{"id": "t", "items": []}])
    assert rows == []


def test_gantt_data_missing_segment_id_defaults_to_unknown():
    track = {"items": [{"id": "x", "start_sec": 1.0, "duration_sec": 2.0}]}
    rows = _gantt_data([track])
    assert rows[0]["segment_id"] == "unknown"


# ---------------------------------------------------------------------------
# _list_local_songs
# ---------------------------------------------------------------------------

def test_list_local_songs_returns_only_audio(tmp_path):
    (tmp_path / "track.mp3").touch()
    (tmp_path / "theme.wav").touch()
    (tmp_path / "readme.txt").touch()
    (tmp_path / "cover.jpg").touch()
    songs = _list_local_songs(str(tmp_path))
    assert songs == ["theme.wav", "track.mp3"] or set(songs) == {"track.mp3", "theme.wav"}
    assert "readme.txt" not in songs
    assert "cover.jpg" not in songs


def test_list_local_songs_sorted(tmp_path):
    for name in ["z.mp3", "a.ogg", "m.flac"]:
        (tmp_path / name).touch()
    songs = _list_local_songs(str(tmp_path))
    assert songs == sorted(songs)


def test_list_local_songs_missing_dir():
    assert _list_local_songs("/nonexistent/path/songs") == []


def test_list_local_songs_all_audio_extensions(tmp_path):
    exts = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"]
    for ext in exts:
        (tmp_path / f"track{ext}").touch()
    songs = _list_local_songs(str(tmp_path))
    assert len(songs) == len(exts)


def test_list_local_songs_uppercase_extension(tmp_path):
    (tmp_path / "LOUD.MP3").touch()
    songs = _list_local_songs(str(tmp_path))
    assert "LOUD.MP3" in songs
