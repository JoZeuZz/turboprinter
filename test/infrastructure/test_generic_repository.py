from __future__ import annotations

from app.domain.operational.models import DecisionRule, Experiment
from app.infrastructure.database import schema
from app.infrastructure.database.repositories.generic import Repository


def test_create_get_list_experiments():
    repo = Repository(schema.experiments, Experiment)

    created = repo.create(name="exp-1", hypothesis="more views")

    fetched = repo.get(created.id)
    assert fetched is not None
    assert fetched.name == "exp-1"
    assert fetched.hypothesis == "more views"

    listed = repo.list(name="exp-1")
    assert len(listed) == 1
    assert listed[0].id == created.id


def test_create_get_list_decision_rules():
    repo = Repository(schema.decision_rules, DecisionRule)

    created = repo.create(name="rule-1", condition_json="{}", action_json="{}")

    fetched = repo.get(created.id)
    assert fetched is not None
    assert fetched.enabled is True

    listed = repo.list(enabled=True)
    assert len(listed) == 1


def test_get_returns_none_when_missing():
    repo = Repository(schema.experiments, Experiment)
    assert repo.get("does-not-exist") is None
