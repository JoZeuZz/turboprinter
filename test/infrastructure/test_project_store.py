import pytest

from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan, ShotSegment
from app.domain.projects.models import (
    TimelineItem,
    TimelineProject,
    TimelineTrack,
)
from app.infrastructure.storage.base import ProjectStoreError
from app.infrastructure.storage.filesystem_store import FilesystemProjectStore


def _store(tmp_path) -> FilesystemProjectStore:
    return FilesystemProjectStore(base_tasks_dir=str(tmp_path))


def _shot_plan() -> ShotPlan:
    return ShotPlan(
        language="es",
        script="guion",
        segments=[
            ShotSegment(
                id="seg_001",
                order=1,
                narration_text="texto",
                target_duration_sec=5.0,
                visual_goal="goal",
                search_queries=["q1"],
            )
        ],
    )


def test_shot_plan_roundtrip(tmp_path):
    store = _store(tmp_path)
    plan = _shot_plan()
    store.save_shot_plan("task1", plan)
    loaded = store.load_shot_plan("task1")
    assert loaded == plan


def test_timeline_roundtrip(tmp_path):
    store = _store(tmp_path)
    project = TimelineProject(
        task_id="task1",
        tracks=[
            TimelineTrack(
                id="t1",
                type="video",
                name="v",
                items=[TimelineItem(id="i1", start_sec=0.0, duration_sec=5.0)],
            )
        ],
    )
    store.save_timeline("task1", project)
    loaded = store.load_timeline("task1")
    assert loaded == project


def test_media_candidates_roundtrip(tmp_path):
    store = _store(tmp_path)
    cands = [
        MediaCandidate(id="m1", provider="pexels"),
        MediaCandidate(id="m2", provider="pixabay", score=0.5),
    ]
    store.save_media_candidates("task1", cands)
    loaded = store.load_media_candidates("task1")
    assert loaded == cands


def test_load_missing_returns_none(tmp_path):
    store = _store(tmp_path)
    assert store.load_shot_plan("ghost") is None
    assert store.load_timeline("ghost") is None
    assert store.load_render_spec("ghost") is None
    assert not (tmp_path / "ghost").exists()


def test_load_missing_media_returns_empty_list(tmp_path):
    store = _store(tmp_path)
    assert store.load_media_candidates("ghost") == []


def test_corrupt_json_raises(tmp_path):
    store = _store(tmp_path)
    store.save_shot_plan("task1", _shot_plan())
    target = tmp_path / "task1" / "shot_plan.json"
    target.write_text("{ not valid json", encoding="utf-8")
    with pytest.raises(ProjectStoreError):
        store.load_shot_plan("task1")


def test_render_manifest_and_result_roundtrip(tmp_path):
    from app.domain.rendering.models import RenderManifest, RenderResult
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    assert store.load_render_manifest("task-1") is None
    assert store.load_render_result("task-1") is None

    manifest = RenderManifest(
        project_id="task-1", task_id="task-1", renderer="moviepy",
        output_path="/tmp/final.mp4", video_item_count=2, total_duration_sec=7.0,
    )
    result = RenderResult(
        project_id="task-1", output_path="/tmp/final.mp4",
        renderer_used="moviepy", success=True, duration_sec=7.0,
    )
    store.save_render_manifest("task-1", manifest)
    store.save_render_result("task-1", result)

    loaded_manifest = store.load_render_manifest("task-1")
    loaded_result = store.load_render_result("task-1")
    assert loaded_manifest is not None and loaded_manifest.video_item_count == 2
    assert loaded_result is not None and loaded_result.success is True
