from __future__ import annotations

from sqlalchemy import Connection

from app.infrastructure.database import schema


def upgrade(connection: Connection) -> None:
    schema.metadata.create_all(connection, checkfirst=True)
