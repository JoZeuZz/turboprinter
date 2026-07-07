# app/application/services/project_preflight.py
from __future__ import annotations

import os

from app.domain.projects.models import TimelineProject, TimelineTrack
from app.domain.projects.preflight import PreflightCheck, PreflightResult
from app.domain.projects.validators import (
    validate_item_bounds,
    validate_no_gaps,
    validate_no_overlaps,
)
from app.infrastructure.storage.base import ProjectStore
from app.utils.file_security import resolve_path_within_directory


def _is_url(path: str) -> bool:
    return path.startswith("http://") or path.startswith("https://")


def _has_traversal(path: str) -> bool:
    return ".." in path.replace("\\", "/").split("/")


def _asset_exists(item_local_path: str | None) -> bool:
    return bool(item_local_path) and not _is_url(item_local_path) and os.path.isfile(item_local_path)


class ProjectPreflightService:
    def __init__(self, store: ProjectStore) -> None:
        self._store = store

    def run(self, task_id: str) -> PreflightResult:
        project = self._store.load_timeline(task_id)
        if project is None:
            check = PreflightCheck(
                id="timeline_exists", passed=False, severity="error",
                message="no timeline_project.json found for this project",
            )
            return PreflightResult(
                project_id=task_id, valid=False, errors=[check.message],
                warnings=[], summary="Timeline missing — build it first.",
                checks=[check],
            )

        checks: list[PreflightCheck] = [
            PreflightCheck(id="timeline_exists", passed=True, severity="error", message="timeline exists"),
            self._check_video_track_exists(project),
        ]
        checks.extend(self._check_item_bounds(project))
        checks.extend(self._check_no_gaps_overlaps(project))
        checks.append(self._check_no_critical_placeholders(project))
        checks.extend(self._check_local_assets(project))
        checks.append(self._check_narration(project))
        checks.append(self._check_subtitles(project, task_id))
        checks.append(self._check_music(project, task_id))
        checks.append(self._check_export_settings(project))
        checks.append(self._check_repeated_media(project))
        checks.append(self._check_license_metadata(project, task_id))

        errors = [c.message for c in checks if not c.passed and c.severity == "error"]
        warnings = [c.message for c in checks if not c.passed and c.severity == "warning"]
        valid = not errors
        summary = (
            "Project is ready to render."
            if valid and not warnings
            else f"{len(errors)} error(s), {len(warnings)} warning(s)."
        )
        checks.append(PreflightCheck(
            id="render_readiness", passed=valid, severity="error",
            message="project is ready to render" if valid else
                     "project has blocking errors and is not ready to render",
        ))
        return PreflightResult(
            project_id=task_id, valid=valid, errors=errors, warnings=warnings,
            summary=summary, checks=checks,
        )

    @staticmethod
    def _check_video_track_exists(project: TimelineProject) -> PreflightCheck:
        has_video = any(t.type == "video" and t.items for t in project.tracks)
        return PreflightCheck(
            id="video_track_exists", passed=has_video, severity="error",
            message="video track exists" if has_video else "timeline has no video track with items",
        )

    @staticmethod
    def _check_item_bounds(project: TimelineProject) -> list[PreflightCheck]:
        results: list[PreflightCheck] = []
        for track in project.tracks:
            for item in track.items:
                try:
                    validate_item_bounds(item)
                except ValueError as exc:
                    results.append(PreflightCheck(
                        id=f"item_bounds:{track.id}:{item.id}", passed=False,
                        severity="error", message=str(exc),
                    ))
        if not results:
            results.append(PreflightCheck(
                id="item_bounds", passed=True, severity="error",
                message="all item bounds and trims are valid",
            ))
        return results

    @staticmethod
    def _check_no_gaps_overlaps(project: TimelineProject) -> list[PreflightCheck]:
        results: list[PreflightCheck] = []
        for track in project.tracks:
            if track.type != "video":
                continue
            try:
                validate_no_gaps(track)
            except ValueError as exc:
                results.append(PreflightCheck(
                    id=f"no_gaps:{track.id}", passed=False, severity="error", message=str(exc),
                ))
            try:
                validate_no_overlaps(track)
            except ValueError as exc:
                results.append(PreflightCheck(
                    id=f"no_overlaps:{track.id}", passed=False, severity="error", message=str(exc),
                ))
        if not results:
            results.append(PreflightCheck(
                id="no_gaps_overlaps", passed=True, severity="error",
                message="video track has no gaps or overlaps",
            ))
        return results

    @staticmethod
    def _check_no_critical_placeholders(project: TimelineProject) -> PreflightCheck:
        placeholder_ids = [
            item.id for track in project.tracks if track.type == "video"
            for item in track.items
            if item.provider == "placeholder" or item.local_path is None
        ]
        passed = not placeholder_ids
        return PreflightCheck(
            id="no_critical_placeholders", passed=passed, severity="error",
            message="no placeholder clips in video track" if passed else
                     f"video track has placeholder/missing clips: {', '.join(placeholder_ids)}",
        )

    @staticmethod
    def _check_local_assets(project: TimelineProject) -> list[PreflightCheck]:
        from app.utils import utils

        results: list[PreflightCheck] = []
        storage_root = utils.storage_dir()
        for track in project.tracks:
            for item in track.items:
                path = item.local_path
                if not path or _is_url(path):
                    continue
                check_id = f"asset:{track.id}:{item.id}"
                if _has_traversal(path):
                    results.append(PreflightCheck(
                        id=check_id, passed=False, severity="error",
                        message=f"asset path contains a traversal segment: {path}",
                    ))
                    continue
                if not os.path.isfile(path):
                    results.append(PreflightCheck(
                        id=check_id, passed=False, severity="error",
                        message=f"referenced asset does not exist on disk: {path}",
                    ))
                    continue
                try:
                    resolve_path_within_directory(storage_root, path, require_file=True)
                except ValueError:
                    results.append(PreflightCheck(
                        id=f"{check_id}:outside_dir", passed=False, severity="warning",
                        message=f"asset for item {item.id!r} is outside the storage directory",
                    ))
        if not results:
            results.append(PreflightCheck(
                id="local_assets", passed=True, severity="error",
                message="all referenced local assets exist",
            ))
        return results

    @staticmethod
    def _narration_track(project: TimelineProject) -> TimelineTrack | None:
        for track in project.tracks:
            if track.type == "audio" and not track.id.startswith("music"):
                return track
        return None

    @staticmethod
    def _music_track(project: TimelineProject) -> TimelineTrack | None:
        for track in project.tracks:
            if track.type == "audio" and track.id.startswith("music"):
                return track
        return None

    def _check_narration(self, project: TimelineProject) -> PreflightCheck:
        expects_narration = bool(project.script and project.script.strip())
        if not expects_narration:
            return PreflightCheck(
                id="narration_present", passed=True, severity="error",
                message="project has no script, narration not required",
            )
        track = self._narration_track(project)
        has_asset = bool(track and track.items and _asset_exists(track.items[0].local_path))
        return PreflightCheck(
            id="narration_present", passed=has_asset, severity="error",
            message="narration audio is present" if has_asset else
                     "project has a script but no narration audio track/asset was found",
        )

    def _check_subtitles(self, project: TimelineProject, task_id: str) -> PreflightCheck:
        spec = self._store.load_render_spec(task_id)
        wants_subtitles = spec.include_subtitles if spec is not None else True
        if not wants_subtitles:
            return PreflightCheck(
                id="subtitles_present", passed=True, severity="warning",
                message="subtitles are disabled for this render spec",
            )
        track = next((t for t in project.tracks if t.type == "subtitle"), None)
        has_asset = bool(track and track.items and _asset_exists(track.items[0].local_path))
        return PreflightCheck(
            id="subtitles_present", passed=has_asset, severity="warning",
            message="subtitle track is present" if has_asset else
                     "subtitles are expected but no subtitle track/asset was found",
        )

    def _check_music(self, project: TimelineProject, task_id: str) -> PreflightCheck:
        selected = self._store.load_selected_music(task_id)
        if not selected:
            return PreflightCheck(
                id="music_present", passed=True, severity="warning",
                message="no music was selected for this project",
            )
        track = self._music_track(project)
        has_asset = bool(track and track.items and _asset_exists(track.items[0].local_path))
        return PreflightCheck(
            id="music_present", passed=has_asset, severity="warning",
            message="music track is present" if has_asset else
                     "music was selected but no music track/asset was found in the timeline",
        )

    @staticmethod
    def _check_export_settings(project: TimelineProject) -> PreflightCheck:
        export = project.export
        valid = export.width > 0 and export.height > 0 and 1 <= export.fps <= 120
        return PreflightCheck(
            id="export_settings_valid", passed=valid, severity="error",
            message="export settings are valid" if valid else
                     f"invalid export settings: width={export.width} height={export.height} fps={export.fps}",
        )

    @staticmethod
    def _check_repeated_media(project: TimelineProject) -> PreflightCheck:
        repeated = project.metadata.get("repeated_media_segments") or []
        passed = not repeated
        return PreflightCheck(
            id="media_not_repeated", passed=passed, severity="warning",
            message="no repeated/stretched media segments" if passed else
                     f"{len(repeated)} segment(s) reuse a clip stretched to cover the duration",
        )

    def _check_license_metadata(self, project: TimelineProject, task_id: str) -> PreflightCheck:
        selected = {c.id: c for c in self._store.load_selected_media(task_id)}
        missing = []
        for track in project.tracks:
            if track.type != "video":
                continue
            for item in track.items:
                if not item.media_id:
                    continue
                candidate = selected.get(item.media_id)
                if candidate is None or candidate.license is None or candidate.license.type is None:
                    missing.append(item.media_id)
        passed = not missing
        return PreflightCheck(
            id="license_metadata", passed=passed, severity="warning",
            message="all video assets have license metadata" if passed else
                     f"{len(missing)} video asset(s) are missing license metadata",
        )
