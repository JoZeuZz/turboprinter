from __future__ import annotations

from typing import Protocol

from app.domain.projects.models import TimelineProject
from app.domain.rendering.models import RenderResult, RenderSpec


class TimelineRenderer(Protocol):
    name: str

    def render(
        self, project: TimelineProject, spec: RenderSpec, output_dir: str
    ) -> RenderResult: ...
