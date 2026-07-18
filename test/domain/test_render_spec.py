import pytest
from pydantic import ValidationError

from app.domain.rendering.models import RenderResult, RenderSpec


def test_valid_render_spec():
    spec = RenderSpec(project_id="p1", width=1080, height=1920, fps=30)
    assert spec.renderer == "moviepy"
    assert spec.output_format == "mp4"


def test_zero_width_fails():
    with pytest.raises(ValidationError):
        RenderSpec(project_id="p1", width=0, height=1920, fps=30)


def test_zero_fps_fails():
    with pytest.raises(ValidationError):
        RenderSpec(project_id="p1", width=1080, height=1920, fps=0)


def test_fps_too_high_fails():
    with pytest.raises(ValidationError):
        RenderSpec(project_id="p1", width=1080, height=1920, fps=200)


def test_render_result_roundtrip():
    r = RenderResult(
        project_id="p1",
        output_path="/out/final.mp4",
        renderer_used="moviepy",
        success=True,
    )
    back = RenderResult.model_validate_json(r.model_dump_json())
    assert back.success is True
    assert back.output_path == "/out/final.mp4"
