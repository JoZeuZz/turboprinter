from __future__ import annotations

import os

from pydantic import ValidationError

from app.domain.workspaces.models import Workspace


class WorkspaceStoreError(Exception):
    def __init__(self, path: str, cause: Exception) -> None:
        self.path = path
        self.cause = cause
        super().__init__(f"WorkspaceStore error at {path}: {cause}")


class WorkspaceStore:
    def __init__(self, base_dir: str | None = None) -> None:
        self._base = base_dir

    def _dir(self, *, make: bool = False) -> str:
        if self._base is not None:
            path = self._base
        else:
            from app.utils import utils

            path = utils.storage_dir("workspaces")
        if make and not os.path.exists(path):
            os.makedirs(path)
        return path

    def _path(self, workspace_id: str, *, make: bool = False) -> str:
        return os.path.join(self._dir(make=make), f"{workspace_id}.json")

    def save(self, workspace: Workspace) -> None:
        path = self._path(workspace.id, make=True)
        try:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(workspace.model_dump_json(indent=2))
        except OSError as exc:
            raise WorkspaceStoreError(path, exc) from exc

    def load(self, workspace_id: str) -> Workspace | None:
        path = self._path(workspace_id)
        if not os.path.isfile(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as fh:
                raw = fh.read()
        except OSError as exc:
            raise WorkspaceStoreError(path, exc) from exc
        try:
            return Workspace.model_validate_json(raw)
        except ValidationError as exc:
            raise WorkspaceStoreError(path, exc) from exc

    def list(self) -> list[Workspace]:
        directory = self._dir()
        if not os.path.isdir(directory):
            return []
        workspaces: list[Workspace] = []
        for name in sorted(os.listdir(directory)):
            if not name.endswith(".json"):
                continue
            workspace_id = name[: -len(".json")]
            workspace = self.load(workspace_id)
            if workspace is not None:
                workspaces.append(workspace)
        workspaces.sort(key=lambda w: w.updated_at, reverse=True)
        return workspaces

    def delete(self, workspace_id: str) -> bool:
        path = self._path(workspace_id)
        if not os.path.isfile(path):
            return False
        os.remove(path)
        return True

    def exists(self, workspace_id: str) -> bool:
        return os.path.isfile(self._path(workspace_id))
