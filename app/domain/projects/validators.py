from __future__ import annotations

from app.domain.projects.models import TimelineItem, TimelineProject, TimelineTrack


def validate_item_bounds(item: TimelineItem) -> None:
    if item.start_sec < 0:
        raise ValueError(f"item {item.id!r} has negative start_sec")
    if item.duration_sec <= 0:
        raise ValueError(f"item {item.id!r} has non-positive duration_sec")
    if item.trim_start_sec < 0:
        raise ValueError(f"item {item.id!r} has negative trim_start_sec")
    if item.trim_end_sec is not None and item.trim_start_sec >= item.trim_end_sec:
        raise ValueError(
            f"item {item.id!r} trim_start_sec must be less than trim_end_sec"
        )
    if item.trim_end_sec is not None:
        trim_range = item.trim_end_sec - item.trim_start_sec
        if trim_range + 1e-6 < item.duration_sec:
            raise ValueError(
                f"item {item.id!r} trim range is shorter than duration_sec"
            )


def validate_no_gaps(track: TimelineTrack, tolerance_sec: float = 0.05) -> None:
    items = track.items
    if items and items[0].start_sec > tolerance_sec:
        raise ValueError(f"gap before first item {items[0].id!r} in track {track.id!r}")
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


def validate_timeline_project(project: TimelineProject) -> None:
    for track in project.tracks:
        for item in track.items:
            validate_item_bounds(item)
        if track.type == "video":
            validate_no_gaps(track)
            validate_no_overlaps(track)
