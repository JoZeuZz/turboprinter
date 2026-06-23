from __future__ import annotations

import pytest

from app.application.services.timeline_builder import TimelineBuilder
from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan, ShotSegment


def _segment(seg_id: str, order: int, duration: float) -> ShotSegment:
    return ShotSegment(
        id=seg_id,
        order=order,
        narration_text=f"Narration {order}",
        target_duration_sec=duration,
        visual_goal=f"Visual goal {order}",
        search_queries=[f"query {order}"],
    )


def _plan() -> ShotPlan:
    return ShotPlan(
        task_id="task-1",
        language="es",
        topic="demo",
        script="Uno. Dos. Tres.",
        segments=[
            _segment("seg_001", 1, 3.0),
            _segment("seg_002", 2, 4.0),
            _segment("seg_003", 3, 2.5),
        ],
    )


def _candidate(seg_id: str, cid: str, duration: float = 10.0) -> MediaCandidate:
    return MediaCandidate(
        id=cid,
        provider="pexels",
        local_path=f"/tmp/{cid}.mp4",
        duration_sec=duration,
        segment_id=seg_id,
        score=4.2,
        score_reasons=["test"],
    )


def test_build_creates_contiguous_video_track():
    selected = {
        "seg_001": _candidate("seg_001", "mc-1"),
        "seg_002": _candidate("seg_002", "mc-2"),
        "seg_003": _candidate("seg_003", "mc-3"),
    }
    project = TimelineBuilder().build(_plan(), selected, task_id="task-1")

    assert project.project_id == "task-1"
    assert project.task_id == "task-1"
    assert project.script == "Uno. Dos. Tres."
    assert len(project.tracks) == 1
    video = project.tracks[0]
    assert video.id == "video_1"
    assert video.type == "video"
    assert [item.start_sec for item in video.items] == [0.0, 3.0, 7.0]
    assert [item.duration_sec for item in video.items] == [3.0, 4.0, 2.5]
    assert [item.media_id for item in video.items] == ["mc-1", "mc-2", "mc-3"]
    assert [item.local_path for item in video.items] == [
        "/tmp/mc-1.mp4",
        "/tmp/mc-2.mp4",
        "/tmp/mc-3.mp4",
    ]
    assert project.metadata["timeline_duration_sec"] == 9.5
    assert project.metadata["missing_media_segments"] == []


def test_build_repeats_short_candidate_to_cover_segment():
    plan = ShotPlan(
        task_id="task-1",
        language="es",
        topic="demo",
        script="Uno. Dos.",
        segments=[_segment("seg_short", 1, 5.0), _segment("seg_next", 2, 3.0)],
    )
    project = TimelineBuilder().build(
        plan,
        {
            "seg_short": _candidate("seg_short", "mc-short", duration=2.0),
            "seg_next": _candidate("seg_next", "mc-next", duration=10.0),
        },
        task_id="task-1",
    )

    video_items = project.tracks[0].items
    repeated_items = video_items[:3]
    assert [item.duration_sec for item in repeated_items] == [2.0, 2.0, 1.0]
    assert [item.start_sec for item in repeated_items] == [0.0, 2.0, 4.0]
    assert [item.media_id for item in repeated_items] == ["mc-short", "mc-short", "mc-short"]
    assert [item.segment_id for item in repeated_items] == ["seg_short", "seg_short", "seg_short"]
    assert [item.local_path for item in repeated_items] == ["/tmp/mc-short.mp4"] * 3
    assert [item.provider for item in repeated_items] == ["pexels", "pexels", "pexels"]
    assert [item.trim_start_sec for item in repeated_items] == [0.0, 0.0, 0.0]
    assert [item.trim_end_sec for item in repeated_items] == [2.0, 2.0, 1.0]
    assert video_items[3].segment_id == "seg_next"
    assert video_items[3].start_sec == 5.0
    assert project.metadata["repeated_media_segments"] == [
        {
            "segment_id": "seg_short",
            "media_id": "mc-short",
            "source_duration_sec": 2.0,
            "target_duration_sec": 5.0,
            "parts": 3,
        }
    ]


def test_build_repeats_float_multiple_without_epsilon_part():
    plan = ShotPlan(
        task_id="task-1",
        language="es",
        topic="demo",
        script="Uno.",
        segments=[_segment("seg_float", 1, 0.9)],
    )

    project = TimelineBuilder().build(
        plan,
        {"seg_float": _candidate("seg_float", "mc-float", duration=0.3)},
        task_id="task-1",
    )

    video_items = project.tracks[0].items
    assert len(video_items) == 3
    assert [item.duration_sec for item in video_items] == [0.3, 0.3, 0.3]
    assert project.metadata["repeated_media_segments"] == [
        {
            "segment_id": "seg_float",
            "media_id": "mc-float",
            "source_duration_sec": 0.3,
            "target_duration_sec": 0.9,
            "parts": 3,
        }
    ]


def test_build_treats_non_positive_candidate_duration_as_invalid_placeholder():
    plan = ShotPlan(
        task_id="task-1",
        language="es",
        topic="demo",
        script="Uno.",
        segments=[_segment("seg_zero_media", 1, 2.0)],
    )

    project = TimelineBuilder().build(
        plan,
        {"seg_zero_media": _candidate("seg_zero_media", "mc-zero", duration=0.0)},
        task_id="task-1",
    )

    item = project.tracks[0].items[0]
    assert item.provider == "placeholder"
    assert item.media_id is None
    assert item.local_path is None
    assert item.segment_id == "seg_zero_media"
    assert item.duration_sec == 2.0
    assert project.metadata["missing_media_segments"] == []
    assert project.metadata["invalid_media_segments"] == [
        {"segment_id": "seg_zero_media", "media_id": "mc-zero", "duration_sec": 0.0}
    ]


def test_build_treats_sub_epsilon_candidate_duration_as_invalid_placeholder():
    plan = ShotPlan(
        task_id="task-1",
        language="es",
        topic="demo",
        script="Uno.",
        segments=[_segment("seg_tiny_media", 1, 2.0)],
    )

    project = TimelineBuilder().build(
        plan,
        {"seg_tiny_media": _candidate("seg_tiny_media", "mc-tiny", duration=0.0000001)},
        task_id="task-1",
    )

    item = project.tracks[0].items[0]
    assert item.provider == "placeholder"
    assert item.media_id is None
    assert item.local_path is None
    assert project.metadata["invalid_media_segments"] == [
        {"segment_id": "seg_tiny_media", "media_id": "mc-tiny", "duration_sec": 0.0000001}
    ]


def test_build_accepts_selected_media_list():
    project = TimelineBuilder().build(_plan(), [
        _candidate("seg_001", "mc-1"),
        _candidate("seg_002", "mc-2"),
        _candidate("seg_003", "mc-3"),
    ], task_id="task-1")
    assert [item.media_id for item in project.tracks[0].items] == ["mc-1", "mc-2", "mc-3"]


def test_build_creates_placeholder_for_missing_segment():
    project = TimelineBuilder().build(_plan(), {"seg_001": _candidate("seg_001", "mc-1")}, task_id="task-1")
    items = project.tracks[0].items
    assert items[1].provider == "placeholder"
    assert items[1].media_id is None
    assert items[1].local_path is None
    assert project.metadata["missing_media_segments"] == ["seg_002", "seg_003"]


def test_build_rejects_non_positive_segment_duration():
    plan = ShotPlan(language="es", script="Zero.", segments=[_segment("seg_zero", 1, 0.0)])
    with pytest.raises(ValueError, match="seg_zero"):
        TimelineBuilder().build(plan, {})


def test_build_adds_audio_and_subtitle_tracks():
    project = TimelineBuilder().build(
        _plan(),
        {"seg_001": _candidate("seg_001", "mc-1"), "seg_002": _candidate("seg_002", "mc-2"), "seg_003": _candidate("seg_003", "mc-3")},
        task_id="task-1",
        narration_audio_path="/tmp/narration.mp3",
        subtitle_path="/tmp/subtitles.srt",
    )
    assert [track.type for track in project.tracks] == ["video", "audio", "subtitle"]
    assert project.tracks[1].items[0].local_path == "/tmp/narration.mp3"
    assert project.tracks[1].items[0].duration_sec == 9.5
    assert project.tracks[2].items[0].local_path == "/tmp/subtitles.srt"
    assert project.tracks[2].items[0].duration_sec == 9.5


def test_build_persists_timeline(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    project = TimelineBuilder(store=store).build(
        _plan(), {"seg_001": _candidate("seg_001", "mc-1")}, task_id="task-1"
    )

    loaded = store.load_timeline("task-1")
    assert loaded is not None
    assert loaded.project_id == project.project_id
    assert loaded.metadata["missing_media_segments"] == ["seg_002", "seg_003"]


def test_build_from_store_loads_plan_and_selected_media(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    store.save_shot_plan("task-1", _plan())
    store.save_selected_media(
        "task-1",
        [
            _candidate("seg_001", "mc-1"),
            _candidate("seg_002", "mc-2"),
            _candidate("seg_003", "mc-3"),
        ],
    )

    project = TimelineBuilder(store=store).build_from_store("task-1", title="Demo")

    assert project.title == "Demo"
    assert [item.media_id for item in project.tracks[0].items] == ["mc-1", "mc-2", "mc-3"]
    assert store.load_timeline("task-1") is not None


def test_build_from_store_uses_selected_music_volume(tmp_path):
    from app.domain.music.models import MusicTrack
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    store.save_shot_plan("task-1", _plan())
    store.save_selected_media(
        "task-1",
        [
            _candidate("seg_001", "mc-1"),
            _candidate("seg_002", "mc-2"),
            _candidate("seg_003", "mc-3"),
        ],
    )
    store.save_selected_music(
        "task-1",
        [MusicTrack(id="m1", provider="local", local_path="/tmp/song.mp3", volume=0.33)],
    )

    project = TimelineBuilder(store=store).build_from_store("task-1")

    music_track = [track for track in project.tracks if track.id == "music_1"][0]
    assert music_track.items[0].volume == 0.33


def test_build_from_store_requires_store():
    with pytest.raises(ValueError, match="ProjectStore"):
        TimelineBuilder().build_from_store("task-1")


def test_build_from_store_requires_shot_plan(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    with pytest.raises(ValueError, match="shot_plan"):
        TimelineBuilder(store=store).build_from_store("missing")


def test_get_timeline_builder_uses_project_mode_flag(monkeypatch):
    from app.application.services import timeline_builder as tb

    monkeypatch.setattr(tb.config, "project_mode_enabled", False)
    assert tb.get_timeline_builder() is None

    monkeypatch.setattr(tb.config, "project_mode_enabled", True)
    assert isinstance(tb.get_timeline_builder(), tb.TimelineBuilder)


def test_build_adds_music_track_with_volume():
    from app.domain.music.models import MusicTrack
    music = MusicTrack(id="m1", provider="local", local_path="/tmp/song.mp3", title="calm")
    project = TimelineBuilder().build(
        _plan(),
        {"seg_001": _candidate("seg_001", "mc-1"),
         "seg_002": _candidate("seg_002", "mc-2"),
         "seg_003": _candidate("seg_003", "mc-3")},
        task_id="task-1",
        narration_audio_path="/tmp/narration.mp3",
        music_track=music,
        music_volume=0.15,
    )
    music_tracks = [t for t in project.tracks if t.id == "music_1"]
    assert len(music_tracks) == 1
    item = music_tracks[0].items[0]
    assert item.local_path == "/tmp/song.mp3"
    assert item.duration_sec == 9.5
    assert item.volume == 0.15
    assert project.metadata["music_track_id"] == "m1"


def test_build_without_music_has_no_music_track():
    project = TimelineBuilder().build(
        _plan(),
        {"seg_001": _candidate("seg_001", "mc-1"),
         "seg_002": _candidate("seg_002", "mc-2"),
         "seg_003": _candidate("seg_003", "mc-3")},
        task_id="task-1",
    )
    assert all(t.id != "music_1" for t in project.tracks)
