from __future__ import annotations

from app.application.services.shot_planner import heuristic_shot_plan


def test_heuristic_plan_is_valid_and_ordered():
    script = "Empezó con miedo. Luego encontró fuerza. Al final lo logró."
    plan = heuristic_shot_plan(script, language="es", target_duration_sec=30.0, topic="superación")
    assert plan.language == "es"
    assert len(plan.segments) >= 1
    assert [s.order for s in plan.segments] == sorted(s.order for s in plan.segments)
    for seg in plan.segments:
        assert seg.search_queries  # nunca vacío (validador del modelo)
        assert seg.target_duration_sec > 0


def test_heuristic_plan_distributes_duration():
    script = "Uno dos tres cuatro. Cinco seis siete ocho."
    plan = heuristic_shot_plan(script, language="es", target_duration_sec=20.0)
    total = sum(s.target_duration_sec for s in plan.segments)
    assert abs(total - 20.0) < 0.01


def test_heuristic_plan_is_deterministic():
    script = "Una frase. Otra frase distinta."
    a = heuristic_shot_plan(script, language="es", target_duration_sec=10.0, topic="x")
    b = heuristic_shot_plan(script, language="es", target_duration_sec=10.0, topic="x")
    assert a.model_dump() == b.model_dump()


def test_heuristic_plan_empty_segment_uses_topic_fallback():
    # script sin keywords útiles (palabras cortas) cae al topic para queries
    plan = heuristic_shot_plan("a, b, c.", language="es", topic="gatos")
    assert all(seg.search_queries for seg in plan.segments)
