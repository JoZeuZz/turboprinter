from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.infrastructure.database.repositories.jobs import JobRepository


def _now() -> datetime:
    return datetime.now(timezone.utc)


def test_create_get_list():
    repo = JobRepository()
    created = repo.create(type="render_project", project_id="p1", scheduled_at=_now())

    fetched = repo.get(created.id)
    assert fetched is not None
    assert fetched.status == "pending"

    listed = repo.list(project_id="p1")
    assert len(listed) == 1


def test_list_filtered_by_status_and_type():
    repo = JobRepository()
    repo.create(type="render_project", project_id="p1", scheduled_at=_now())
    repo.create(type="plan_project", project_id="p2", scheduled_at=_now())

    listed = repo.list_filtered(type="render_project")
    assert len(listed) == 1
    assert listed[0].type == "render_project"


def test_claim_next_returns_none_when_empty():
    repo = JobRepository()
    assert repo.claim_next() is None


def test_claim_next_returns_none_when_scheduled_in_future():
    repo = JobRepository()
    repo.create(type="render_project", scheduled_at=_now() + timedelta(hours=1))
    assert repo.claim_next() is None


def test_claim_next_claims_earliest_pending_job():
    repo = JobRepository()
    older = repo.create(type="render_project", scheduled_at=_now() - timedelta(minutes=5))
    repo.create(type="render_project", scheduled_at=_now())

    claimed = repo.claim_next()

    assert claimed is not None
    assert claimed.id == older.id
    assert claimed.status == "running"
    assert claimed.attempts == 1
    assert claimed.started_at is not None


def test_claim_next_does_not_double_claim():
    repo = JobRepository()
    repo.create(type="render_project", scheduled_at=_now())

    first = repo.claim_next()
    second = repo.claim_next()

    assert first is not None
    assert second is None


def test_cancel_pending_job():
    repo = JobRepository()
    created = repo.create(type="render_project", scheduled_at=_now())

    cancelled = repo.cancel(created.id)

    assert cancelled is not None
    assert cancelled.status == "cancelled"


def test_cancel_running_job_is_noop():
    repo = JobRepository()
    created = repo.create(type="render_project", scheduled_at=_now())
    repo.claim_next()

    assert repo.cancel(created.id) is None


def test_mark_completed():
    repo = JobRepository()
    created = repo.create(type="render_project", scheduled_at=_now())
    repo.claim_next()

    completed = repo.mark_completed(created.id)

    assert completed is not None
    assert completed.status == "completed"
    assert completed.completed_at is not None


def test_mark_failed_or_retry_reschedules_when_attempts_remain():
    repo = JobRepository()
    created = repo.create(type="render_project", scheduled_at=_now(), max_attempts=3)
    repo.claim_next()

    retried = repo.mark_failed_or_retry(created.id, error="boom", backoff_seconds=30)

    assert retried is not None
    assert retried.status == "pending"
    assert retried.last_error == "boom"
    assert retried.scheduled_at > _now()


def test_mark_failed_or_retry_fails_when_attempts_exhausted():
    repo = JobRepository()
    created = repo.create(type="render_project", scheduled_at=_now(), max_attempts=1)
    repo.claim_next()

    failed = repo.mark_failed_or_retry(created.id, error="boom", backoff_seconds=30)

    assert failed is not None
    assert failed.status == "failed"
    assert failed.last_error == "boom"
