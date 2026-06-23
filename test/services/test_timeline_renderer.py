from __future__ import annotations

from app.domain.projects.models import (
    ExportSettings,
    TimelineItem,
    TimelineProject,
    TimelineTrack,
)
from app.domain.rendering.models import RenderSpec
from app.infrastructure.renderers.moviepy_renderer import (
    MoviePyTimelineRenderer,
    _aspect_for,
)
from app.models.schema import VideoAspect


def _video_item(item_id: str, path: str | None, start: float, dur: float) -> TimelineItem:
    return TimelineItem(
        id=item_id, media_id=item_id, local_path=path,
        start_sec=start, duration_sec=dur, segment_id=item_id, provider="pexels",
    )


def _project() -> TimelineProject:
    video = TimelineTrack(id="video_1", type="video", name="Video", items=[
        _video_item("a", "/tmp/a.mp4", 0.0, 3.0),
        _video_item("b", None, 3.0, 2.0),
    ])
    audio = TimelineTrack(id="audio_1", type="audio", name="Audio", items=[
        TimelineItem(id="narr", local_path="/tmp/narration.mp3", start_sec=0.0, duration_sec=5.0),
    ])
    subs = TimelineTrack(id="subtitle_1", type="subtitle", name="Subtitles", items=[
        TimelineItem(id="srt", local_path="/tmp/subs.srt", start_sec=0.0, duration_sec=5.0),
    ])
    return TimelineProject(
        project_id="task-1", task_id="task-1", title="Demo", script="Uno. Dos.",
        tracks=[video, audio, subs], export=ExportSettings(width=1080, height=1920, fps=30),
    )


def test_aspect_for_known_resolutions():
    assert _aspect_for(1920, 1080) == VideoAspect.landscape
    assert _aspect_for(1080, 1920) == VideoAspect.portrait
    assert _aspect_for(1080, 1080) == VideoAspect.square
    assert _aspect_for(999, 333) == VideoAspect.portrait


def test_resolve_render_inputs():
    inputs = MoviePyTimelineRenderer()._resolve_render_inputs(_project())
    assert [i.id for i in inputs.video_items] == ["a", "b"]
    assert inputs.narration_path == "/tmp/narration.mp3"
    assert inputs.subtitle_path == "/tmp/subs.srt"
    assert inputs.total_duration_sec == 5.0


def test_build_video_params_maps_export_and_spec():
    project = _project()
    spec = RenderSpec(
        project_id="task-1", width=1080, height=1920, fps=30,
        include_subtitles=True, include_background_music=False,
    )
    params = MoviePyTimelineRenderer()._build_video_params(project, spec)
    assert params.video_subject == "Demo"
    assert params.video_aspect == VideoAspect.portrait
    assert params.subtitle_enabled is True
    assert params.bgm_type == ""
    assert params.bgm_file == ""


def test_build_video_params_keeps_bgm_when_enabled():
    project = _project()
    spec = RenderSpec(
        project_id="task-1", width=1920, height=1080, fps=30,
        include_subtitles=False, include_background_music=True,
    )
    params = MoviePyTimelineRenderer()._build_video_params(project, spec)
    assert params.video_aspect == VideoAspect.landscape
    assert params.subtitle_enabled is False
    assert params.bgm_type == "random"


import os

import pytest

from app.infrastructure.renderers import moviepy_renderer as mr


def _spec() -> RenderSpec:
    return RenderSpec(project_id="task-1", width=1080, height=1920, fps=30)


def test_render_orchestrates_concat_and_generate(monkeypatch, tmp_path):
    calls = {}

    def fake_concat(items, width, height, out_path, threads=2):
        calls["concat"] = {"count": len(items), "size": (width, height), "out": out_path}
        with open(out_path, "wb") as fh:
            fh.write(b"video")

    def fake_generate(video_path, audio_path, subtitle_path, output_file, params):
        calls["generate"] = {
            "video": video_path, "audio": audio_path,
            "subtitle": subtitle_path, "output": output_file,
        }
        with open(output_file, "wb") as fh:
            fh.write(b"final-output-bytes")

    monkeypatch.setattr(mr, "_concat_timeline_clips", fake_concat)
    monkeypatch.setattr(mr.video, "generate_video", fake_generate)

    result = MoviePyTimelineRenderer().render(_project(), _spec(), str(tmp_path))

    assert result.success is True
    assert result.renderer_used == "moviepy"
    assert os.path.exists(result.output_path)
    assert result.file_size_bytes == len(b"final-output-bytes")
    assert calls["concat"]["count"] == 2
    assert calls["concat"]["size"] == (1080, 1920)
    assert calls["generate"]["audio"] == "/tmp/narration.mp3"
    assert calls["generate"]["subtitle"] == "/tmp/subs.srt"


def test_render_persists_manifest_and_result(monkeypatch, tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    monkeypatch.setattr(mr, "_concat_timeline_clips", lambda *a, **k: open(a[3], "wb").close())
    monkeypatch.setattr(
        mr.video, "generate_video",
        lambda video_path, audio_path, subtitle_path, output_file, params: open(
            output_file, "wb"
        ).write(b"x"),
    )
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path / "tasks"))
    result = MoviePyTimelineRenderer(store=store).render(
        _project(), _spec(), str(tmp_path / "out")
    )
    assert result.success is True
    manifest = store.load_render_manifest("task-1")
    assert manifest is not None
    assert manifest.video_item_count == 2
    assert manifest.has_audio is True
    assert manifest.has_subtitles is True
    assert store.load_render_result("task-1") is not None


def test_render_returns_failure_on_exception(monkeypatch, tmp_path):
    def boom(*args, **kwargs):
        raise RuntimeError("ffmpeg exploded")

    monkeypatch.setattr(mr, "_concat_timeline_clips", boom)
    result = MoviePyTimelineRenderer().render(_project(), _spec(), str(tmp_path))
    assert result.success is False
    assert "ffmpeg exploded" in (result.error or "")
    assert result.renderer_used == "moviepy"


def test_opencut_adapter_raises_not_implemented():
    from app.infrastructure.renderers.opencut_adapter import OpenCutAdapter

    adapter = OpenCutAdapter()
    assert adapter.name == "opencut"
    with pytest.raises(NotImplementedError, match="OpenCut"):
        adapter.render(_project(), _spec(), "/tmp/out")
