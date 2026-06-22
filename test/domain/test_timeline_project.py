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
    before = p.updated_at
    p.apply(MoveClipCommand(track_id="t1", item_id="i1", new_start_sec=2.0))
    item = p.tracks[0].items[0]
    assert item.start_sec == 2.0
    assert p.updated_at >= before


def test_apply_trim_updates_trim():
    p = _project()
    p.apply(TrimClipCommand(track_id="t1", item_id="i1", trim_start_sec=1.0, trim_end_sec=4.0))
    item = p.tracks[0].items[0]
    assert item.trim_start_sec == 1.0
    assert item.trim_end_sec == 4.0


def test_apply_replace_updates_media():
    p = _project()
    cand = MediaCandidate(id="m9", provider="pixabay", local_path="/new.mp4")
    p.apply(ReplaceClipCommand(track_id="t1", item_id="i1", new_candidate=cand))
    item = p.tracks[0].items[0]
    assert item.media_id == "m9"
    assert item.local_path == "/new.mp4"
    assert item.provider == "pixabay"


def test_apply_set_timing_updates_duration():
    p = _project()
    p.apply(SetClipTimingCommand(track_id="t1", item_id="i1", duration_sec=7.5))
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
