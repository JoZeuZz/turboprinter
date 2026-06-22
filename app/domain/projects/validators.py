from __future__ import annotations

from app.domain.projects.models import TimelineTrack


def validate_no_gaps(track: TimelineTrack, tolerance_sec: float = 0.05) -> None:
    items = track.items
    for prev, nxt in zip(items, items[1:]):
        prev_end = prev.start_sec + prev.duration_sec
        gap = nxt.start_sec - prev_end
        if gap > tolerance_sec:
            raise ValueError(
                f"gap of {gap:.3f}s between {prev.id!r} and {nxt.id!r} "
                f"in track {track.id!r}"
            )


def validate_no_overlaps(track: TimelineTrack, tolerance_sec: float = 0.05) -> None:
    items = track.items
    for prev, nxt in zip(items, items[1:]):
        prev_end = prev.start_sec + prev.duration_sec
        overlap = prev_end - nxt.start_sec
        if overlap > tolerance_sec:
            raise ValueError(
                f"overlap of {overlap:.3f}s between {prev.id!r} and {nxt.id!r} "
                f"in track {track.id!r}"
            )
