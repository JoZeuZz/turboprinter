from __future__ import annotations

from app.domain.operational.models import ProjectRun
from app.infrastructure.database import schema
from app.infrastructure.database.repositories.generic import Repository


class ProjectRunRepository(Repository[ProjectRun]):
    def __init__(self) -> None:
        super().__init__(schema.project_runs, ProjectRun)

    def get_by_project_id(self, project_id: str) -> ProjectRun | None:
        matches = self.list(project_id=project_id)
        return matches[0] if matches else None
