from __future__ import annotations

import logging
import time

from app.config import config
from app.domain.operational.models import Job
from app.infrastructure.database.repositories.jobs import JobRepository
from app.workers.handlers import HANDLERS

logger = logging.getLogger(__name__)


def _backoff_seconds(attempts: int) -> int:
    return min(30 * 2 ** max(attempts - 1, 0), 600)


def _execute(repo: JobRepository, job: Job) -> None:
    try:
        HANDLERS[job.type](job)
    except Exception as exc:  # noqa: BLE001 - any handler failure must be retried, not crash the loop
        logger.warning("job %s (%s) failed: %s", job.id, job.type, exc)
        repo.mark_failed_or_retry(
            job.id, error=str(exc), backoff_seconds=_backoff_seconds(job.attempts)
        )
        return
    repo.mark_completed(job.id)


def run_forever(poll_interval: float | None = None) -> None:
    interval = poll_interval if poll_interval is not None else config.jobs_poll_interval_sec
    repo = JobRepository()
    logger.info("job worker started, poll_interval=%ss", interval)
    while True:
        job = repo.claim_next()
        if job is None:
            time.sleep(interval)
            continue
        _execute(repo, job)


if __name__ == "__main__":
    run_forever()
