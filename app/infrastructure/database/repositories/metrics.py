from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.domain.operational.models import AGE_WINDOWS, MetricsSnapshot
from app.infrastructure.database import schema
from app.infrastructure.database.repositories.generic import Repository


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(raw: str | None, fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except ValueError:
        return fallback


def _window_order(value: str) -> int:
    try:
        return AGE_WINDOWS.index(value)
    except ValueError:
        return len(AGE_WINDOWS)


class MetricsSnapshotRepository(Repository[MetricsSnapshot]):
    def __init__(self) -> None:
        super().__init__(schema.metrics_snapshots, MetricsSnapshot)

    def _from_row(self, row) -> MetricsSnapshot:
        data = dict(row._mapping)
        for key, value in data.items():
            if isinstance(value, datetime) and value.tzinfo is None:
                data[key] = value.replace(tzinfo=timezone.utc)
        data["collected_at"] = data.get("collected_at") or data.get("captured_at")
        data["metadata"] = _json_loads(data.pop("metadata_json", None), _json_loads(data.get("raw_json"), {}))
        data.pop("captured_at", None)
        data.pop("shares", None)
        data.pop("raw_json", None)
        data["platform"] = data.get("platform") or "youtube"
        data["age_window"] = data.get("age_window") or "24h"
        return MetricsSnapshot(**data)

    def _to_values(self, snapshot: MetricsSnapshot) -> dict:
        values = snapshot.model_dump()
        values["metadata_json"] = _json_dumps(values.pop("metadata"))
        values["captured_at"] = values["collected_at"]
        values.pop("shares", None)
        values.pop("raw_json", None)
        return values

    def upsert(self, snapshot: MetricsSnapshot) -> MetricsSnapshot:
        values = self._to_values(snapshot)
        existing = self.get_for_window(snapshot.publication_id, snapshot.platform, snapshot.age_window)
        with self._engine().begin() as connection:
            if existing is None:
                connection.execute(schema.metrics_snapshots.insert().values(**values))
                return snapshot
            values["id"] = existing.id
            connection.execute(
                schema.metrics_snapshots.update()
                .where(schema.metrics_snapshots.c.id == existing.id)
                .values(**values)
            )
        return self.get(existing.id) or snapshot.model_copy(update={"id": existing.id})

    def get_for_window(self, publication_id: str, platform: str, age_window: str) -> MetricsSnapshot | None:
        query = schema.metrics_snapshots.select().where(
            schema.metrics_snapshots.c.publication_id == publication_id,
            schema.metrics_snapshots.c.platform == platform,
            schema.metrics_snapshots.c.age_window == age_window,
        )
        with self._engine().connect() as connection:
            row = connection.execute(query).fetchone()
        return self._from_row(row) if row is not None else None

    def list_for_publication(self, publication_id: str) -> list[MetricsSnapshot]:
        snapshots = self.list(publication_id=publication_id)
        return sorted(snapshots, key=lambda s: (_window_order(s.age_window), s.collected_at))

    def list_for_workspace(self, workspace_id: str) -> list[MetricsSnapshot]:
        query = schema.metrics_snapshots.select().select_from(
            schema.metrics_snapshots.join(
                schema.publications,
                schema.metrics_snapshots.c.publication_id == schema.publications.c.id,
            )
        ).where(schema.publications.c.workspace_id == workspace_id)
        with self._engine().connect() as connection:
            rows = connection.execute(query).fetchall()
        return sorted([self._from_row(row) for row in rows], key=lambda s: (s.publication_id, _window_order(s.age_window)))

    def list_for_project(self, project_id: str) -> list[MetricsSnapshot]:
        query = schema.metrics_snapshots.select().select_from(
            schema.metrics_snapshots.join(
                schema.publications,
                schema.metrics_snapshots.c.publication_id == schema.publications.c.id,
            )
        ).where(schema.publications.c.project_id == project_id)
        with self._engine().connect() as connection:
            rows = connection.execute(query).fetchall()
        return sorted([self._from_row(row) for row in rows], key=lambda s: (s.publication_id, _window_order(s.age_window)))
