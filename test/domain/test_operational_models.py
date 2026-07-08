from __future__ import annotations

from app.domain.operational.models import (
    DecisionEvent,
    DecisionRule,
    Experiment,
    ExperimentVariant,
    Job,
    MetricsSnapshot,
    Publication,
    ProjectRun,
    VideoOutput,
)


def test_project_run_defaults():
    run = ProjectRun(project_id="p1", task_id="p1", source="topic")
    assert run.status == "created"
    assert run.id
    assert run.created_at is not None


def test_decision_rule_defaults():
    rule = DecisionRule(name="r1", condition_json="{}", action_json="{}")
    assert rule.enabled is True


def test_all_operational_models_instantiate_with_minimal_fields():
    ProjectRun(project_id="p", task_id="t", source="topic")
    VideoOutput(project_run_id="r", file_path="/tmp/x.mp4")
    Publication(video_output_id="v", platform="youtube")
    MetricsSnapshot(publication_id="pub")
    Experiment(name="e")
    ExperimentVariant(experiment_id="e", name="v")
    DecisionRule(name="r", condition_json="{}", action_json="{}")
    DecisionEvent()


def test_job_defaults():
    job = Job(type="render_project")
    assert job.status == "pending"
    assert job.attempts == 0
    assert job.max_attempts == 3
    assert job.payload_json == "{}"
    assert job.workspace_id is None
    assert job.project_id is None
    assert job.started_at is None
    assert job.completed_at is None
    assert job.last_error is None
    assert job.id
    assert job.scheduled_at is not None
