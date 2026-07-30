"""Integration test for the real MoviePy concat path.

Exercises `_concat_timeline_clips` with actual tiny mp4 files (no monkeypatch),
verifying trims are honoured and a placeholder black clip fills a gap. Skipped
when moviepy/ffmpeg cannot encode in this environment.
"""
from __future__ import annotations

import os

import pytest

from app.domain.projects.models import TimelineItem
from app.infrastructure.renderers import moviepy_renderer as mr

_W, _H = 64, 64


def _make_source(path: str, seconds: float, color) -> None:
    from moviepy import ColorClip

    clip = ColorClip(size=(_W, _H), color=color).with_duration(seconds)
    clip.write_videofile(path, fps=10, codec="libx264", audio=False, logger=None)
    clip.close()


@pytest.fixture
def sources(tmp_path):
    try:
        a = str(tmp_path / "a.mp4")
        _make_source(a, 5.0, (255, 0, 0))
    except Exception as exc:  # noqa: BLE001 - environment lacks a working encoder
        pytest.skip(f"moviepy/ffmpeg encode unavailable: {exc}")
    return a


def _duration(path: str) -> float:
    from moviepy import VideoFileClip

    clip = VideoFileClip(path)
    try:
        return float(clip.duration)
    finally:
        clip.close()


def test_concat_honours_trim_and_placeholder(sources, tmp_path):
    out = str(tmp_path / "combined.mp4")
    items = [
        TimelineItem(id="a", local_path=sources, start_sec=0.0, duration_sec=2.0,
                     trim_start_sec=1.0, trim_end_sec=3.0, segment_id="s1"),
        TimelineItem(id="b", local_path=None, start_sec=2.0, duration_sec=1.0,
                     segment_id="s2", provider="placeholder"),
    ]
    mr._concat_timeline_clips(items, _W, _H, out, threads=1)

    assert os.path.exists(out)
    assert os.path.getsize(out) > 0
    # trimmed 2s + placeholder 1s ~= 3s (allow encoder rounding)
    assert _duration(out) == pytest.approx(3.0, abs=0.5)


def test_concat_single_clip(sources, tmp_path):
    out = str(tmp_path / "single.mp4")
    items = [TimelineItem(id="a", local_path=sources, start_sec=0.0, duration_sec=2.0,
                          trim_start_sec=0.0, trim_end_sec=2.0, segment_id="s1")]
    mr._concat_timeline_clips(items, _W, _H, out, threads=1)
    assert os.path.exists(out)
    assert _duration(out) == pytest.approx(2.0, abs=0.5)
