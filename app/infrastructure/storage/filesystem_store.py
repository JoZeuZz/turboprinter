from __future__ import annotations

import os

from pydantic import ValidationError

from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan
from app.domain.projects.models import TimelineProject
from app.domain.rendering.models import RenderSpec
from app.infrastructure.storage.base import ProjectStoreError

_SHOT_PLAN = "shot_plan.json"
_TIMELINE = "timeline_project.json"
_RENDER_SPEC = "render_spec.json"
_MEDIA = "media_candidates.json"


class FilesystemProjectStore:
    def __init__(self, base_tasks_dir: str | None = None) -> None:
        self._base = base_tasks_dir

    def _task_dir(self, task_id: str) -> str:
        if self._base is not None:
            path = os.path.join(self._base, task_id)
            os.makedirs(path, exist_ok=True)
            return path
        from app.utils import utils

        return utils.task_dir(task_id)

    def _path(self, task_id: str, filename: str) -> str:
        return os.path.join(self._task_dir(task_id), filename)

    def _write(self, task_id: str, filename: str, payload: str) -> None:
        path = self._path(task_id, filename)
        try:
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(payload)
        except OSError as exc:
            raise ProjectStoreError(path, exc) from exc

    def _read(self, task_id: str, filename: str) -> str | None:
        path = self._path(task_id, filename)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read()
        except OSError as exc:
            raise ProjectStoreError(path, exc) from exc

    def save_shot_plan(self, task_id: str, plan: ShotPlan) -> None:
        self._write(task_id, _SHOT_PLAN, plan.model_dump_json(indent=2))

    def load_shot_plan(self, task_id: str) -> ShotPlan | None:
        raw = self._read(task_id, _SHOT_PLAN)
        if raw is None:
            return None
        try:
            return ShotPlan.model_validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _SHOT_PLAN), exc) from exc

    def save_timeline(self, task_id: str, project: TimelineProject) -> None:
        self._write(task_id, _TIMELINE, project.model_dump_json(indent=2))

    def load_timeline(self, task_id: str) -> TimelineProject | None:
        raw = self._read(task_id, _TIMELINE)
        if raw is None:
            return None
        try:
            return TimelineProject.model_validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _TIMELINE), exc) from exc

    def save_render_spec(self, task_id: str, spec: RenderSpec) -> None:
        self._write(task_id, _RENDER_SPEC, spec.model_dump_json(indent=2))

    def load_render_spec(self, task_id: str) -> RenderSpec | None:
        raw = self._read(task_id, _RENDER_SPEC)
        if raw is None:
            return None
        try:
            return RenderSpec.model_validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _RENDER_SPEC), exc) from exc

    def save_media_candidates(
        self, task_id: str, candidates: list[MediaCandidate]
    ) -> None:
        from pydantic import TypeAdapter

        adapter = TypeAdapter(list[MediaCandidate])
        payload = adapter.dump_json(candidates, indent=2).decode("utf-8")
        self._write(task_id, _MEDIA, payload)

    def load_media_candidates(self, task_id: str) -> list[MediaCandidate]:
        raw = self._read(task_id, _MEDIA)
        if raw is None:
            return []
        from pydantic import TypeAdapter

        adapter = TypeAdapter(list[MediaCandidate])
        try:
            return adapter.validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _MEDIA), exc) from exc
