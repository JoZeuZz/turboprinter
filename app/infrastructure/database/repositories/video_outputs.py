from __future__ import annotations

from app.domain.operational.models import VideoOutput
from app.infrastructure.database import schema
from app.infrastructure.database.repositories.generic import Repository


class VideoOutputRepository(Repository[VideoOutput]):
    def __init__(self) -> None:
        super().__init__(schema.video_outputs, VideoOutput)

    def get_by_project_run_and_path(self, project_run_id: str, file_path: str) -> VideoOutput | None:
        matches = self.list(project_run_id=project_run_id, file_path=file_path)
        return matches[0] if matches else None

    def get_or_create_for_render(self, project_run_id: str, file_path: str) -> VideoOutput:
        existing = self.get_by_project_run_and_path(project_run_id, file_path)
        if existing is not None:
            return existing
        return self.create(project_run_id=project_run_id, file_path=file_path)
