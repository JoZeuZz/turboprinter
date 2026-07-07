# test/services/test_project_preflight.py
from __future__ import annotations

import os

import pytest

from app.application.services.project_preflight import ProjectPreflightService
from app.domain.media.models import MediaCandidate, LicenseInfo
from app.domain.projects.models import (
    ExportSettings,
    TimelineItem,
    TimelineProject,
    TimelineTrack,
)
from app.domain.rendering.models import RenderSpec
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


@pytest.fixture
def store(tmp_path):
    return FilesystemProjectStore(base_tasks_dir=str(tmp_path))


def _asset(tmp_path, name: str) -> str:
    path = tmp_path / name
    path.write_bytes(b"fake")
    return str(path)


def _video_item(item_id, path, start, duration, provider="pexels"):
    return TimelineItem(
        id=item_id, media_id=f"mc-{item_id}", local_path=path,
        start_sec=start, duration_sec=duration, trim_start_sec=0.0,
        trim_end_sec=duration, provider=provider,
    )


def _valid_project(tmp_path, task_id="task-1") -> TimelineProject:
    clip = _asset(tmp_path, "clip.mp4")
    audio = _asset(tmp_path, "audio.mp3")
    sub = _asset(tmp_path, "subtitle.srt")
    video = TimelineTrack(id="video_1", type="video", name="Video", items=[
        _video_item("item_1", clip, 0.0, 3.0),
    ])
    narration = TimelineTrack(id="audio_1", type="audio", name="Audio", items=[
        TimelineItem(id="item_audio_1", local_path=audio, start_sec=0.0, duration_sec=3.0),
    ])
    subtitle = TimelineTrack(id="subtitle_1", type="subtitle", name="Subtitle", items=[
        TimelineItem(id="item_subtitle_1", local_path=sub, start_sec=0.0, duration_sec=3.0),
    ])
    return TimelineProject(
        project_id=task_id, task_id=task_id, script="Uno.",
        tracks=[video, narration, subtitle],
        export=ExportSettings(),
    )


def test_run_returns_error_when_no_timeline(store):
    result = ProjectPreflightService(store).run("missing-task")
    assert result.valid is False
    assert any("timeline" in e.lower() for e in result.errors)


def test_run_valid_project_has_no_errors(store, tmp_path):
    project = _valid_project(tmp_path)
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is True
    assert result.errors == []


def test_run_flags_missing_local_asset(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks[0].items[0].local_path = str(tmp_path / "does-not-exist.mp4")
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is False
    assert any("does not exist" in e for e in result.errors)


def test_run_flags_placeholder_clip(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks[0].items[0].provider = "placeholder"
    project.tracks[0].items[0].local_path = None
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is False
    assert any("placeholder" in e.lower() for e in result.errors)


def test_run_flags_gap_in_video_track(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks[0].items[0].duration_sec = 1.0
    project.tracks[0].items.append(
        _video_item("item_2", _asset(tmp_path, "clip2.mp4"), 5.0, 2.0)
    )
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is False
    assert any("gap" in e.lower() for e in result.errors)


def test_run_flags_overlap_in_video_track(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks[0].items.append(
        _video_item("item_2", _asset(tmp_path, "clip2.mp4"), 1.0, 2.0)
    )
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is False
    assert any("overlap" in e.lower() for e in result.errors)


def test_run_errors_when_script_present_but_no_narration_track(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks = [t for t in project.tracks if t.type != "audio"]
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is False
    assert any("narration" in e.lower() for e in result.errors)


def test_run_warns_when_subtitles_missing_but_expected(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks = [t for t in project.tracks if t.type != "subtitle"]
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is True
    assert any("subtitle" in w.lower() for w in result.warnings)


def test_run_no_subtitle_warning_when_render_spec_disables_subtitles(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks = [t for t in project.tracks if t.type != "subtitle"]
    store.save_timeline("task-1", project)
    store.save_render_spec("task-1", RenderSpec(
        project_id="task-1", task_id="task-1", width=1080, height=1920, fps=30,
        include_subtitles=False,
    ))
    result = ProjectPreflightService(store).run("task-1")
    assert not any("subtitle" in w.lower() for w in result.warnings)


def test_run_warns_when_music_selected_but_missing_from_timeline(store, tmp_path):
    project = _valid_project(tmp_path)
    store.save_timeline("task-1", project)
    from app.domain.music.models import MusicTrack
    store.save_selected_music("task-1", [
        MusicTrack(id="m1", provider="local", title="Track", local_path=None)
    ])
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is True
    assert any("music" in w.lower() for w in result.warnings)


def test_run_warns_on_missing_license_metadata(store, tmp_path):
    project = _valid_project(tmp_path)
    store.save_timeline("task-1", project)
    store.save_selected_media("task-1", [
        MediaCandidate(id="mc-item_1", provider="pexels", local_path=project.tracks[0].items[0].local_path)
    ])
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is True
    assert any("license" in w.lower() for w in result.warnings)


def test_run_no_license_warning_when_license_present(store, tmp_path):
    project = _valid_project(tmp_path)
    store.save_timeline("task-1", project)
    store.save_selected_media("task-1", [
        MediaCandidate(
            id="mc-item_1", provider="pexels",
            local_path=project.tracks[0].items[0].local_path,
            license=LicenseInfo(type="CC0"),
        )
    ])
    result = ProjectPreflightService(store).run("task-1")
    assert not any("license" in w.lower() for w in result.warnings)


def test_run_errors_on_invalid_export_settings(store, tmp_path):
    project = _valid_project(tmp_path)
    project.export = ExportSettings(width=0, height=1920, fps=30)
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is False
    assert any("export" in e.lower() for e in result.errors)


def test_run_flags_asset_path_traversal_as_error(store, tmp_path):
    project = _valid_project(tmp_path)
    project.tracks[0].items[0].local_path = str(tmp_path / ".." / "escaped.mp4")
    store.save_timeline("task-1", project)
    result = ProjectPreflightService(store).run("task-1")
    assert result.valid is False
    assert any("traversal" in e.lower() for e in result.errors)
