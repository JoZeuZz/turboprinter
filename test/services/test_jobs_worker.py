from __future__ import annotations

from datetime import datetime, timezone

from app.infrastructure.database.repositories.jobs import JobRepository
from app.workers import jobs as worker


def _now():
    return datetime.now(timezone.utc)


def test_execute_marks_completed_on_success(monkeypatch):
    monkeypatch.setitem(worker.HANDLERS, "noop", lambda job: None)
    repo = JobRepository()
    created = repo.create(type="noop", scheduled_at=_now())
    claimed = repo.claim_next()

    worker._execute(repo, claimed)

    fetched = repo.get(created.id)
    assert fetched.status == "completed"
    assert fetched.completed_at is not None


def test_execute_retries_when_attempts_remain(monkeypatch):
    monkeypatch.setitem(worker.HANDLERS, "boom", lambda job: (_ for _ in ()).throw(ValueError("boom")))
    repo = JobRepository()
    created = repo.create(type="boom", scheduled_at=_now(), max_attempts=3)
    claimed = repo.claim_next()

    worker._execute(repo, claimed)

    fetched = repo.get(created.id)
    assert fetched.status == "pending"
    assert fetched.attempts == 1
    assert fetched.last_error == "boom"
    assert fetched.scheduled_at > claimed.started_at


def test_execute_marks_failed_when_attempts_exhausted(monkeypatch):
    monkeypatch.setitem(worker.HANDLERS, "boom", lambda job: (_ for _ in ()).throw(ValueError("boom")))
    repo = JobRepository()
    created = repo.create(type="boom", scheduled_at=_now(), max_attempts=1)
    claimed = repo.claim_next()

    worker._execute(repo, claimed)

    fetched = repo.get(created.id)
    assert fetched.status == "failed"
    assert fetched.last_error == "boom"


def test_backoff_seconds_grows_and_caps():
    assert worker._backoff_seconds(1) == 30
    assert worker._backoff_seconds(2) == 60
    assert worker._backoff_seconds(3) == 120
    assert worker._backoff_seconds(10) == 600
