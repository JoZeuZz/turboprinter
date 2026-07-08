from __future__ import annotations

from app.infrastructure.storage.filesystem_store import FilesystemProjectStore
from app.utils import utils


def create_project(
    store: FilesystemProjectStore,
    *,
    topic: str | None = None,
    script: str | None = None,
    workspace_id: str | None = None,
    **metadata,
) -> str:
    task_id = utils.get_uuid()
    store.save_script(task_id, script or "")
    store.save_project_metadata(task_id, topic=topic, workspace_id=workspace_id, **metadata)
    return task_id
