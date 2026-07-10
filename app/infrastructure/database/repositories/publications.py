from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from app.domain.publication.models import Publication, PublicationResult
from app.infrastructure.database import schema
from app.infrastructure.database.repositories.generic import Repository


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False)


def _json_loads(raw: str | None, fallback: Any) -> Any:
    if not raw:
        return fallback
    try:
        return json.loads(raw)
    except ValueError:
        return fallback


class PublicationRepository(Repository[Publication]):
    def __init__(self) -> None:
        super().__init__(schema.publications, Publication)

    def _from_row(self, row) -> Publication:
        data = dict(row._mapping)
        for key, value in data.items():
            if isinstance(value, datetime) and value.tzinfo is None:
                data[key] = value.replace(tzinfo=timezone.utc)
        data["tags"] = _json_loads(data.pop("tags_json", None), [])
        data["metadata"] = _json_loads(data.pop("metadata_json", None), {})
        data["external_video_id"] = data.get("external_video_id") or data.get("external_id")
        data.pop("external_id", None)
        data["status"] = "draft" if data.get("status") == "pending" else data.get("status", "draft")
        data["title"] = data.get("title") or ""
        data["description"] = data.get("description") or ""
        data["updated_at"] = data.get("updated_at") or data.get("created_at")
        return Publication(**data)

    def _to_values(self, fields: dict) -> dict:
        values = dict(fields)
        if "tags" in values:
            values["tags_json"] = _json_dumps(values.pop("tags"))
        if "metadata" in values:
            values["metadata_json"] = _json_dumps(values.pop("metadata"))
        if "external_video_id" in values:
            values.setdefault("external_id", values["external_video_id"])
        values.setdefault("updated_at", _utcnow())
        return values

    def create(self, **fields) -> Publication:
        instance = Publication(**fields)
        values = self._to_values(instance.model_dump())
        with self._engine().begin() as connection:
            connection.execute(schema.publications.insert().values(**values))
        return instance

    def list_filtered(
        self,
        *,
        project_id: str | None = None,
        workspace_id: str | None = None,
        platform: str | None = None,
        status: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Publication]:
        query = schema.publications.select()
        if project_id is not None:
            query = query.where(schema.publications.c.project_id == project_id)
        if workspace_id is not None:
            query = query.where(schema.publications.c.workspace_id == workspace_id)
        if platform is not None:
            query = query.where(schema.publications.c.platform == platform)
        if status == "draft":
            query = query.where(schema.publications.c.status.in_(["draft", "pending"]))
        elif status is not None:
            query = query.where(schema.publications.c.status == status)
        query = query.order_by(schema.publications.c.created_at.desc()).limit(limit).offset(offset)
        with self._engine().connect() as connection:
            rows = connection.execute(query).fetchall()
        return [self._from_row(row) for row in rows]

    def update(self, publication_id: str, **fields) -> Publication | None:
        values = self._to_values(fields)
        values["updated_at"] = _utcnow()
        with self._engine().begin() as connection:
            connection.execute(
                schema.publications.update()
                .where(schema.publications.c.id == publication_id)
                .values(**values)
            )
        return self.get(publication_id)

    def mark_publishing(self, publication_id: str) -> Publication | None:
        return self.update(publication_id, status="publishing", error=None)

    def mark_published(self, publication_id: str, result: PublicationResult) -> Publication | None:
        return self.update(
            publication_id,
            status="published",
            error=None,
            external_video_id=result.external_video_id,
            published_at=result.published_at or _utcnow(),
            metadata=result.metadata,
        )

    def mark_failed(self, publication_id: str, error: str) -> Publication | None:
        return self.update(publication_id, status="failed", error=error)
