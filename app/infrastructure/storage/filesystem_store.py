from __future__ import annotations

import os

from pydantic import TypeAdapter, ValidationError

from app.domain.media.models import MediaCandidate
from app.domain.music.models import MusicTrack
from app.domain.planning.models import ShotPlan
from app.domain.projects.models import TimelineProject
from app.domain.rendering.models import RenderManifest, RenderResult, RenderSpec
from app.infrastructure.storage.base import ProjectStoreError

_MEDIA_ADAPTER: TypeAdapter[list[MediaCandidate]] = TypeAdapter(list[MediaCandidate])
_MUSIC_ADAPTER: TypeAdapter[list[MusicTrack]] = TypeAdapter(list[MusicTrack])

_SCRIPT = "script.txt"
_SHOT_PLAN = "shot_plan.json"
_TIMELINE = "timeline_project.json"
_RENDER_SPEC = "render_spec.json"
_RENDER_MANIFEST = "render_manifest.json"
_RENDER_RESULT = "render_result.json"
_MEDIA = "media_candidates.json"
_SELECTED = "selected_media.json"
_SELECTED_MUSIC = "selected_music.json"


class FilesystemProjectStore:
    def __init__(self, base_tasks_dir: str | None = None) -> None:
        self._base = base_tasks_dir

    def _task_dir(self, task_id: str, *, make: bool = False) -> str:
        if self._base is not None:
            path = os.path.join(self._base, task_id)
            if make:
                os.makedirs(path, exist_ok=True)
            return path
        from app.utils import utils

        return utils.task_dir(task_id)

    def _path(self, task_id: str, filename: str, *, make: bool = False) -> str:
        return os.path.join(self._task_dir(task_id, make=make), filename)

    def _write(self, task_id: str, filename: str, payload: str) -> None:
        path = self._path(task_id, filename, make=True)
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

    def project_dir(self, task_id: str, *, make: bool = False) -> str:
        return self._task_dir(task_id, make=make)

    def save_script(self, task_id: str, script: str) -> None:
        self._write(task_id, _SCRIPT, script)

    def load_script(self, task_id: str) -> str | None:
        return self._read(task_id, _SCRIPT)

    def exists(self, task_id: str) -> bool:
        return os.path.exists(self._path(task_id, _SCRIPT)) or any(
            os.path.exists(self._path(task_id, name))
            for name in (_SHOT_PLAN, _TIMELINE, _SELECTED)
        )

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

    def save_render_manifest(self, task_id: str, manifest: RenderManifest) -> None:
        self._write(task_id, _RENDER_MANIFEST, manifest.model_dump_json(indent=2))

    def load_render_manifest(self, task_id: str) -> RenderManifest | None:
        raw = self._read(task_id, _RENDER_MANIFEST)
        if raw is None:
            return None
        try:
            return RenderManifest.model_validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _RENDER_MANIFEST), exc) from exc

    def save_render_result(self, task_id: str, result: RenderResult) -> None:
        self._write(task_id, _RENDER_RESULT, result.model_dump_json(indent=2))

    def load_render_result(self, task_id: str) -> RenderResult | None:
        raw = self._read(task_id, _RENDER_RESULT)
        if raw is None:
            return None
        try:
            return RenderResult.model_validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _RENDER_RESULT), exc) from exc

    def save_selected_music(self, task_id: str, tracks: list[MusicTrack]) -> None:
        payload = _MUSIC_ADAPTER.dump_json(tracks, indent=2).decode("utf-8")
        self._write(task_id, _SELECTED_MUSIC, payload)

    def load_selected_music(self, task_id: str) -> list[MusicTrack]:
        raw = self._read(task_id, _SELECTED_MUSIC)
        if raw is None:
            return []
        try:
            return _MUSIC_ADAPTER.validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _SELECTED_MUSIC), exc) from exc

    def save_media_candidates(
        self, task_id: str, candidates: list[MediaCandidate]
    ) -> None:
        payload = _MEDIA_ADAPTER.dump_json(candidates, indent=2).decode("utf-8")
        self._write(task_id, _MEDIA, payload)

    def load_media_candidates(self, task_id: str) -> list[MediaCandidate]:
        raw = self._read(task_id, _MEDIA)
        if raw is None:
            return []
        try:
            return _MEDIA_ADAPTER.validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _MEDIA), exc) from exc

    def save_selected_media(
        self, task_id: str, selected: list[MediaCandidate]
    ) -> None:
        payload = _MEDIA_ADAPTER.dump_json(selected, indent=2).decode("utf-8")
        self._write(task_id, _SELECTED, payload)

    def load_selected_media(self, task_id: str) -> list[MediaCandidate]:
        raw = self._read(task_id, _SELECTED)
        if raw is None:
            return []
        try:
            return _MEDIA_ADAPTER.validate_json(raw)
        except ValidationError as exc:
            raise ProjectStoreError(self._path(task_id, _SELECTED), exc) from exc
