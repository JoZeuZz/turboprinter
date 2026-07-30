import pytest
from pydantic import ValidationError

from app.domain.planning.models import MusicIntent, ShotPlan, ShotSegment


def _segment(order: int = 1, **kw) -> ShotSegment:
    base = dict(
        id=f"seg_{order:03d}",
        order=order,
        narration_text="texto",
        target_duration_sec=5.0,
        visual_goal="person at sunrise",
        search_queries=["sunrise cinematic"],
    )
    base.update(kw)
    return ShotSegment(**base)


def test_valid_shot_plan_builds():
    plan = ShotPlan(
        language="es",
        script="guion completo",
        segments=[_segment(1), _segment(2)],
    )
    assert plan.schema_version == "1.0"
    assert len(plan.segments) == 2


def test_shot_plan_without_segments_fails():
    with pytest.raises(ValidationError):
        ShotPlan(language="es", script="x", segments=[])


def test_segment_without_queries_fails():
    with pytest.raises(ValidationError):
        _segment(1, search_queries=[])


def test_segments_out_of_order_fails():
    with pytest.raises(ValidationError):
        ShotPlan(
            language="es",
            script="x",
            segments=[_segment(2), _segment(1)],
        )


def test_music_intent_optional():
    plan = ShotPlan(
        language="es",
        script="x",
        segments=[_segment(1)],
        music_intent=MusicIntent(mood="inspirational", energy="medium"),
    )
    assert plan.music_intent.mood == "inspirational"
