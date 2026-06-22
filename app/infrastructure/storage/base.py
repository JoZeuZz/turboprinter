from __future__ import annotations

from typing import Protocol

from app.domain.media.models import MediaCandidate
from app.domain.planning.models import ShotPlan
from app.domain.projects.models import TimelineProject
from app.domain.rendering.models import RenderSpec


class ProjectStoreError(Exception):
    def __init__(self, path: str, cause: Exception) -> None:
        self.path = path
        self.cause = cause
        super().__init__(f"ProjectStore error at {path}: {cause}")


class ProjectStore(Protocol):
    def save_shot_plan(self, task_id: str, plan: ShotPlan) -> None: ...
    def load_shot_plan(self, task_id: str) -> ShotPlan | None: ...
    def save_timeline(self, task_id: str, project: TimelineProject) -> None: ...
    def load_timeline(self, task_id: str) -> TimelineProject | None: ...
    def save_render_spec(self, task_id: str, spec: RenderSpec) -> None: ...
    def load_render_spec(self, task_id: str) -> RenderSpec | None: ...
    def save_media_candidates(
        self, task_id: str, candidates: list[MediaCandidate]
    ) -> None: ...
    def load_media_candidates(self, task_id: str) -> list[MediaCandidate]: ...
