from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.domain.media.models import MediaCandidate
from app.domain.projects.commands import (
    MoveClipCommand,
    ReplaceClipCommand,
    SetClipTimingCommand,
    SetClipVolumeCommand,
    TrimClipCommand,
)
from app.domain.projects.models import (
    ExportSettings,
    TimelineItem,
    TimelineProject,
    TimelineTrack,
)


def _project() -> TimelineProject:
    track = TimelineTrack(
        id="t1",
        type="video",
        name="video",
        items=[
            TimelineItem(id="i1", local_path="/a.mp4", start_sec=0.0, duration_sec=5.0),
            TimelineItem(id="i2", local_path="/b.mp4", start_sec=5.0, duration_sec=5.0),
        ],
    )
    return TimelineProject(task_id="task1", tracks=[track])


def test_defaults_and_ids():
    p = TimelineProject()
    assert p.schema_version == "1.0"
    assert p.project_id  # uuid generated
    assert p.export.width == 1080
    assert p.export.height == 1920


def test_roundtrip_serialization():
    p = _project()
    raw = p.model_dump_json()
    back = TimelineProject.model_validate_json(raw)
    assert back.tracks[0].items[1].id == "i2"
    assert back.task_id == "task1"


def test_track_items_must_be_sorted_by_start():
    with pytest.raises(ValidationError):
        TimelineTrack(
            id="t1",
            type="video",
            name="video",
            items=[
                TimelineItem(id="i1", start_sec=5.0, duration_sec=5.0),
                TimelineItem(id="i2", start_sec=0.0, duration_sec=5.0),
            ],
        )


def test_apply_move_updates_start_and_timestamp():
    p = _project()
    p.updated_at = datetime(2000, 1, 1, tzinfo=timezone.utc)
    p.apply(MoveClipCommand(track_id="t1", item_id="i1", new_start_sec=2.0), validate=False)
    item = p.tracks[0].items[0]
    assert item.start_sec == 2.0
    assert p.updated_at.year != 2000


def test_apply_trim_updates_trim():
    p = _project()
    p.apply(TrimClipCommand(track_id="t1", item_id="i1", trim_start_sec=1.0, trim_end_sec=6.0))
    item = p.tracks[0].items[0]
    assert item.trim_start_sec == 1.0
    assert item.trim_end_sec == 6.0


def test_apply_replace_updates_media():
    p = _project()
    cand = MediaCandidate(id="m9", provider="pixabay", local_path="/new.mp4")
    p.apply(ReplaceClipCommand(track_id="t1", item_id="i1", new_candidate=cand))
    item = p.tracks[0].items[0]
    assert item.media_id == "m9"
    assert item.local_path == "/new.mp4"
    assert item.provider == "pixabay"


def test_apply_replace_uses_candidate_source_fallback_as_path():
    p = _project()
    cand = MediaCandidate(id="m9", provider="pixabay", source_url="https://example.com/new.mp4")
    p.apply(ReplaceClipCommand(track_id="t1", item_id="i1", new_candidate=cand))

    item = p.tracks[0].items[0]
    assert item.media_id == "m9"
    assert item.local_path == "https://example.com/new.mp4"


def test_apply_set_timing_updates_duration():
    p = _project()
    p.apply(
        SetClipTimingCommand(track_id="t1", item_id="i1", duration_sec=7.5),
        validate=False,
    )
    assert p.tracks[0].items[0].duration_sec == 7.5


def test_apply_set_volume_updates_volume():
    p = _project()
    p.apply(SetClipVolumeCommand(track_id="t1", item_id="i1", volume=0.3))
    assert p.tracks[0].items[0].volume == 0.3


def test_apply_unknown_item_raises():
    p = _project()
    with pytest.raises(KeyError):
        p.apply(MoveClipCommand(track_id="t1", item_id="nope", new_start_sec=1.0))


def test_apply_unknown_track_raises():
    p = _project()
    with pytest.raises(KeyError):
        p.apply(MoveClipCommand(track_id="nope", item_id="i1", new_start_sec=1.0))


def test_apply_invalid_trim_rejects_without_mutating():
    p = _project()

    with pytest.raises(ValueError, match="trim_start_sec"):
        p.apply(TrimClipCommand(
            track_id="t1", item_id="i1", trim_start_sec=4.0, trim_end_sec=1.0,
        ))

    item = p.tracks[0].items[0]
    assert item.trim_start_sec == 0.0
    assert item.trim_end_sec is None


def test_apply_trim_shorter_than_duration_rejects_without_mutating():
    p = _project()

    with pytest.raises(ValueError, match="trim range"):
        p.apply(TrimClipCommand(
            track_id="t1", item_id="i1", trim_start_sec=1.0, trim_end_sec=2.0,
        ))

    item = p.tracks[0].items[0]
    assert item.trim_start_sec == 0.0
    assert item.trim_end_sec is None


def test_apply_set_timing_overlap_rejects_without_mutating():
    p = _project()

    with pytest.raises(ValueError, match="overlap"):
        p.apply(SetClipTimingCommand(track_id="t1", item_id="i1", duration_sec=7.5))

    assert p.tracks[0].items[0].duration_sec == 5.0


def test_apply_all_can_reorder_contiguously():
    p = _project()

    updated = p.apply_all([
        MoveClipCommand(track_id="t1", item_id="i2", new_start_sec=0.0),
        MoveClipCommand(track_id="t1", item_id="i1", new_start_sec=5.0),
    ])

    items = updated.tracks[0].items
    assert [item.id for item in items] == ["i2", "i1"]
    assert [item.start_sec for item in items] == [0.0, 5.0]
    assert [item.duration_sec for item in items] == [5.0, 5.0]
    assert [item.id for item in p.tracks[0].items] == ["i1", "i2"]


def test_replace_missing_local_path_rejects_when_verifiable():
    p = _project()
    cand = MediaCandidate(id="m9", provider="pixabay", local_path="/missing.mp4")

    with pytest.raises(ValueError, match="does not exist"):
        p.apply(
            ReplaceClipCommand(track_id="t1", item_id="i1", new_candidate=cand),
            media_path_exists=lambda path: False,
        )

    assert p.tracks[0].items[0].media_id is None
