from __future__ import annotations

from datetime import datetime, timezone
from typing import Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import Engine, Table

ModelT = TypeVar("ModelT", bound=BaseModel)


class Repository(Generic[ModelT]):
    def __init__(self, table: Table, model: type[ModelT]) -> None:
        self._table = table
        self._model = model

    def _engine(self) -> Engine:
        from app.infrastructure.database.engine import get_engine

        engine = get_engine()
        if engine is None:
            raise RuntimeError("database is disabled ([database].enabled = false)")
        return engine

    def _from_row(self, row) -> ModelT:
        data = dict(row._mapping)
        for key, value in data.items():
            if isinstance(value, datetime) and value.tzinfo is None:
                data[key] = value.replace(tzinfo=timezone.utc)
        return self._model(**data)

    def create(self, **fields) -> ModelT:
        instance = self._model(**fields)
        with self._engine().begin() as connection:
            connection.execute(self._table.insert().values(**instance.model_dump()))
        return instance

    def get(self, id: str) -> ModelT | None:
        with self._engine().connect() as connection:
            row = connection.execute(
                self._table.select().where(self._table.c.id == id)
            ).fetchone()
        if row is None:
            return None
        return self._from_row(row)

    def list(self, **filters) -> list[ModelT]:
        query = self._table.select()
        for key, value in filters.items():
            query = query.where(self._table.c[key] == value)
        with self._engine().connect() as connection:
            rows = connection.execute(query).fetchall()
        return [self._from_row(row) for row in rows]
