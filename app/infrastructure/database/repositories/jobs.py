from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.domain.operational.models import Job
from app.infrastructure.database import schema
from app.infrastructure.database.repositories.generic import Repository


class JobRepository(Repository[Job]):
    def __init__(self) -> None:
        super().__init__(schema.jobs, Job)

    def list_filtered(
        self,
        *,
        status: str | None = None,
        type: str | None = None,
        workspace_id: str | None = None,
        project_id: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Job]:
        query = schema.jobs.select()
        if status is not None:
            query = query.where(schema.jobs.c.status == status)
        if type is not None:
            query = query.where(schema.jobs.c.type == type)
        if workspace_id is not None:
            query = query.where(schema.jobs.c.workspace_id == workspace_id)
        if project_id is not None:
            query = query.where(schema.jobs.c.project_id == project_id)
        query = query.order_by(schema.jobs.c.created_at.desc()).limit(limit).offset(offset)
        with self._engine().connect() as connection:
            rows = connection.execute(query).fetchall()
        return [self._from_row(row) for row in rows]

    def claim_next(self, job_types: set[str] | None = None) -> Job | None:
        now = datetime.now(timezone.utc)
        subq = select(schema.jobs.c.id).where(
            schema.jobs.c.status == "pending",
            schema.jobs.c.scheduled_at <= now,
        )
        if job_types:
            subq = subq.where(schema.jobs.c.type.in_(job_types))
        subq = subq.order_by(schema.jobs.c.scheduled_at).limit(1)
        stmt = (
            schema.jobs.update()
            .where(schema.jobs.c.id == subq.scalar_subquery())
            .values(
                status="running",
                started_at=now,
                attempts=schema.jobs.c.attempts + 1,
                updated_at=now,
            )
            .returning(*schema.jobs.c)
        )
        with self._engine().begin() as connection:
            row = connection.execute(stmt).fetchone()
        return self._from_row(row) if row is not None else None

    def cancel(self, job_id: str) -> Job | None:
        now = datetime.now(timezone.utc)
        stmt = (
            schema.jobs.update()
            .where(schema.jobs.c.id == job_id, schema.jobs.c.status == "pending")
            .values(status="cancelled", updated_at=now)
            .returning(*schema.jobs.c)
        )
        with self._engine().begin() as connection:
            row = connection.execute(stmt).fetchone()
        return self._from_row(row) if row is not None else None

    def mark_completed(self, job_id: str) -> Job | None:
        now = datetime.now(timezone.utc)
        stmt = (
            schema.jobs.update()
            .where(schema.jobs.c.id == job_id)
            .values(status="completed", completed_at=now, updated_at=now)
            .returning(*schema.jobs.c)
        )
        with self._engine().begin() as connection:
            row = connection.execute(stmt).fetchone()
        return self._from_row(row) if row is not None else None

    def mark_failed_or_retry(
        self, job_id: str, *, error: str, backoff_seconds: int
    ) -> Job | None:
        job = self.get(job_id)
        if job is None:
            return None
        now = datetime.now(timezone.utc)
        if job.attempts < job.max_attempts:
            values = {
                "status": "pending",
                "scheduled_at": now + timedelta(seconds=backoff_seconds),
                "last_error": error,
                "updated_at": now,
            }
        else:
            values = {"status": "failed", "last_error": error, "updated_at": now}
        stmt = schema.jobs.update().where(schema.jobs.c.id == job_id).values(**values)
        with self._engine().begin() as connection:
            connection.execute(stmt)
        return self.get(job_id)
