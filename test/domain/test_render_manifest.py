from __future__ import annotations

from app.domain.rendering.models import RenderManifest


def test_render_manifest_minimal_and_defaults():
    manifest = RenderManifest(
        project_id="task-1",
        task_id="task-1",
        renderer="moviepy",
        output_path="/tmp/final.mp4",
        video_item_count=3,
        total_duration_sec=9.5,
        has_audio=True,
        has_subtitles=True,
        background_music=False,
    )
    assert manifest.schema_version == "1.0"
    assert manifest.warnings == []
    assert manifest.created_at is not None
    dumped = RenderManifest.model_validate_json(manifest.model_dump_json())
    assert dumped.video_item_count == 3
    assert dumped.total_duration_sec == 9.5
