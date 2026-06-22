import pytest

from app.domain.projects.models import TimelineItem, TimelineTrack
from app.domain.projects.validators import validate_no_gaps, validate_no_overlaps


def _track(items: list[TimelineItem]) -> TimelineTrack:
    return TimelineTrack(id="t1", type="video", name="v", items=items)


def test_no_gaps_passes_on_contiguous():
    track = _track([
        TimelineItem(id="i1", start_sec=0.0, duration_sec=5.0),
        TimelineItem(id="i2", start_sec=5.0, duration_sec=5.0),
    ])
    validate_no_gaps(track)  # no raise


def test_no_gaps_raises_on_gap():
    track = _track([
        TimelineItem(id="i1", start_sec=0.0, duration_sec=5.0),
        TimelineItem(id="i2", start_sec=6.0, duration_sec=5.0),
    ])
    with pytest.raises(ValueError):
        validate_no_gaps(track)


def test_no_overlaps_passes_on_contiguous():
    track = _track([
        TimelineItem(id="i1", start_sec=0.0, duration_sec=5.0),
        TimelineItem(id="i2", start_sec=5.0, duration_sec=5.0),
    ])
    validate_no_overlaps(track)  # no raise


def test_no_overlaps_raises_on_overlap():
    track = _track([
        TimelineItem(id="i1", start_sec=0.0, duration_sec=5.0),
        TimelineItem(id="i2", start_sec=4.0, duration_sec=5.0),
    ])
    with pytest.raises(ValueError):
        validate_no_overlaps(track)
