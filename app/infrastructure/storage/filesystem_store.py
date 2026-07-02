from __future__ import annotations

import datetime
import json as _json
import logging
import os
import shutil

from pydantic import TypeAdapter, ValidationError

logger = logging.getLogger(__name__)

from app.domain.media.models import MediaCandidate
from app.domain.music.models import MusicTrack
from app.domain.planning.models import ShotPlan
from app.domain.projects.models import TimelineProject
from app.domain.rendering.models import RenderManifest, RenderResult, RenderSpec
from app.infrastructure.storage.base import ProjectStoreError

_MEDIA_ADAPTER: TypeAdapter[list[MediaCandidate]] = TypeAdapter(list[MediaCandidate])
_MUSIC_ADAPTER: TypeAdapter[list[MusicTrack]] = TypeAdapter(list[MusicTrack])

_SCRIPT = "script.txt"
_PROJECT_META = "project.json"
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

    def save_project_metadata(self, task_id: str, *, topic: str | None = None) -> None:
        payload = {
            "project_id": task_id,
            "topic": topic,
            "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        self._write(task_id, _PROJECT_META, _json.dumps(payload, ensure_ascii=False, indent=2))

    def load_project_metadata(self, task_id: str) -> dict | None:
        raw = self._read(task_id, _PROJECT_META)
        if raw is None:
            return None
        try:
            return _json.loads(raw)
        except ValueError as exc:
            raise ProjectStoreError(self._path(task_id, _PROJECT_META), exc) from exc

    def exists(self, task_id: str) -> bool:
        return os.path.exists(self._path(task_id, _SCRIPT)) or any(
            os.path.exists(self._path(task_id, name))
            for name in (_PROJECT_META, _SHOT_PLAN, _TIMELINE, _SELECTED)
        )

    def delete_project(self, task_id: str) -> None:
        path = self._task_dir(task_id)
        if os.path.isdir(path):
            shutil.rmtree(path)

    def duplicate_video_config(self, task_id: str) -> str:
        from app.utils import utils

        new_id = utils.get_uuid()
        src_spec = self._path(task_id, _RENDER_SPEC)
        if os.path.isfile(src_spec):
            dst_spec = self._path(new_id, _RENDER_SPEC, make=True)
            shutil.copyfile(src_spec, dst_spec)

        origin = self.load_project_metadata(task_id) or {}
        origin_topic = origin.get("topic") or "proyecto"
        self.save_project_metadata(new_id, topic=f"Copia de {origin_topic}")
        return new_id

    def _base_dir(self) -> str:
        """Return the base directory that contains all project subdirectories."""
        if self._base is not None:
            return self._base
        from app.utils import utils
        return utils.task_dir()

    def list_projects(self, limit: int = 20) -> list[dict]:
        """Return recent projects sorted by mtime descending."""
        base = self._base_dir()
        if not os.path.isdir(base):
            return []
        entries: list[dict] = []
        for name in os.listdir(base):
            project_path = os.path.join(base, name)
            if not os.path.isdir(project_path):
                continue
            timeline_path = os.path.join(base, name, _TIMELINE)
            script_path = os.path.join(base, name, _SCRIPT)
            meta_path = os.path.join(base, name, _PROJECT_META)
            if not any(os.path.isfile(path) for path in (timeline_path, script_path, meta_path)):
                continue
            try:
                paths = [path for path in (timeline_path, script_path, meta_path) if os.path.isfile(path)]
                mtime = max(os.path.getmtime(path) for path in paths)
                topic = None
                if os.path.isfile(timeline_path):
                    with open(timeline_path, encoding="utf-8") as fh:
                        data = _json.load(fh)
                    topic = data.get("title") or (
                        (data.get("shot_plan") or {}).get("topic")
                    )
                if topic is None and os.path.isfile(meta_path):
                    with open(meta_path, encoding="utf-8") as fh:
                        meta = _json.load(fh)
                    topic = meta.get("topic")
                if topic is None and os.path.isfile(script_path):
                    with open(script_path, encoding="utf-8") as fh:
                        topic = fh.read(80).strip()
                entries.append({
                    "project_id": name,
                    "topic": topic,
                    "updated_at": mtime,
                })
            except (OSError, ValueError, KeyError) as exc:
                logger.warning("list_projects: skipping %s — %s", name, exc)
                continue
        entries.sort(key=lambda x: x["updated_at"], reverse=True)
        for entry in entries:
            entry["updated_at"] = datetime.datetime.fromtimestamp(
                entry["updated_at"], tz=datetime.timezone.utc
            ).isoformat()
        return entries[:limit]

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
