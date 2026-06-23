from __future__ import annotations

import pytest

from app.application.workflows import render_project as rp
from app.domain.projects.models import (
    ExportSettings,
    TimelineItem,
    TimelineProject,
    TimelineTrack,
)
from app.domain.rendering.models import RenderResult, RenderSpec
from app.infrastructure.renderers.moviepy_renderer import MoviePyTimelineRenderer
from app.infrastructure.renderers.opencut_adapter import OpenCutAdapter
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


def _project() -> TimelineProject:
    video = TimelineTrack(id="video_1", type="video", name="Video", items=[
        TimelineItem(id="a", local_path="/tmp/a.mp4", start_sec=0.0, duration_sec=3.0),
    ])
    return TimelineProject(
        project_id="task-1", task_id="task-1", title="Demo",
        tracks=[video], export=ExportSettings(width=1080, height=1920, fps=30),
    )


def test_get_timeline_renderer_gated_by_project_mode(monkeypatch):
    monkeypatch.setattr(rp.config, "project_mode_enabled", False)
    assert rp.get_timeline_renderer() is None
    monkeypatch.setattr(rp.config, "project_mode_enabled", True)
    monkeypatch.setattr(rp.config, "timeline_renderer", "moviepy")
    assert isinstance(rp.get_timeline_renderer(), MoviePyTimelineRenderer)


def test_get_timeline_renderer_selects_opencut(monkeypatch):
    monkeypatch.setattr(rp.config, "project_mode_enabled", True)
    assert isinstance(rp.get_timeline_renderer("opencut"), OpenCutAdapter)


def test_render_project_from_store_loads_and_renders(monkeypatch, tmp_path):
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path / "tasks"))
    store.save_timeline("task-1", _project())
    store.save_render_spec("task-1", RenderSpec(project_id="task-1", width=1080, height=1920, fps=30))

    captured = {}

    class FakeRenderer:
        name = "fake"

        def render(self, project, spec, output_dir):
            captured["project_id"] = project.project_id
            captured["spec"] = (spec.width, spec.height)
            captured["output_dir"] = output_dir
            return RenderResult(
                project_id=project.project_id, output_path="/tmp/final.mp4",
                renderer_used="fake", success=True,
            )

    result = rp.render_project_from_store(
        "task-1", store, renderer=FakeRenderer(), output_dir=str(tmp_path / "out")
    )
    assert result.success is True
    assert captured["project_id"] == "task-1"
    assert captured["spec"] == (1080, 1920)


def test_render_project_from_store_requires_timeline(tmp_path):
    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path / "tasks"))
    with pytest.raises(ValueError, match="timeline"):
        rp.render_project_from_store("missing", store)
