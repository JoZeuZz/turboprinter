from __future__ import annotations

import pytest

from app.application.services.shot_planner import ShotPlanner, heuristic_shot_plan
from app.domain.planning.models import ShotPlan, ShotSegment


def _valid_plan(language="es"):
    return ShotPlan(
        language=language,
        script="s",
        segments=[
            ShotSegment(
                id="seg_001",
                order=1,
                narration_text="hola",
                target_duration_sec=5.0,
                visual_goal="goal",
                search_queries=["query uno"],
            )
        ],
    )


class _FakeProvider:
    def __init__(self, results):
        # results: lista de (raise_exc | ShotPlan) consumida por intento
        self._results = list(results)
        self.calls = 0

    def capabilities(self, model=None):
        raise NotImplementedError

    def generate_structured(self, prompt, schema, model=None, temperature=0.4):
        self.calls += 1
        item = self._results.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def test_plan_returns_valid_provider_result():
    provider = _FakeProvider([_valid_plan()])
    planner = ShotPlanner(provider)
    plan = planner.plan("hola mundo.", language="es")
    assert provider.calls == 1
    assert plan.segments[0].search_queries == ["query uno"]


def test_plan_repairs_on_first_failure():
    provider = _FakeProvider([ValueError("bad json"), _valid_plan()])
    planner = ShotPlanner(provider)
    plan = planner.plan("hola mundo.", language="es")
    assert provider.calls == 2
    assert plan.segments[0].order == 1


def test_plan_falls_back_to_heuristic():
    provider = _FakeProvider([ValueError("x"), ValueError("y")])
    planner = ShotPlanner(provider)
    plan = planner.plan("Primera. Segunda.", language="es", target_duration_sec=10.0)
    assert provider.calls == 2
    assert len(plan.segments) == 2  # heurístico por oraciones


def test_plan_empty_script_raises():
    planner = ShotPlanner(_FakeProvider([_valid_plan()]))
    with pytest.raises(ValueError):
        planner.plan("   ", language="es")


def test_plan_persists_when_store_and_task_id(tmp_path):
    from app.infrastructure.storage.filesystem_store import FilesystemProjectStore

    store = FilesystemProjectStore(base_tasks_dir=str(tmp_path))
    provider = _FakeProvider([_valid_plan()])
    planner = ShotPlanner(provider, store=store)
    planner.plan("hola.", language="es", task_id="t1")
    loaded = store.load_shot_plan("t1")
    assert loaded is not None
    assert loaded.segments[0].search_queries == ["query uno"]


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


import app.application.services.shot_planner as sp


def test_get_shot_planner_returns_none_when_flag_off(monkeypatch):
    monkeypatch.setattr(sp.config, "structured_shot_planner_enabled", False, raising=False)
    assert sp.get_shot_planner() is None


def test_get_shot_planner_returns_planner_when_flag_on(monkeypatch):
    monkeypatch.setattr(sp.config, "structured_shot_planner_enabled", True, raising=False)
    planner = sp.get_shot_planner()
    assert isinstance(planner, sp.ShotPlanner)
