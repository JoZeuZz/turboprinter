from __future__ import annotations

from app.domain.projects.models import TimelineProject
from app.domain.rendering.models import RenderResult, RenderSpec


class OpenCutAdapter:
    """Experimental placeholder for a future OpenCut-backed renderer.

    OpenCut is not vendored. This adapter only documents the interface and the
    gaps that must be closed before a real integration is possible. See
    docs/architecture/005-opencut-integration-notes.md.
    """

    name = "opencut"

    def render(
        self, project: TimelineProject, spec: RenderSpec, output_dir: str
    ) -> RenderResult:
        raise NotImplementedError(
            "OpenCut renderer is not implemented. Use the 'moviepy' renderer. "
            "See docs/architecture/005-opencut-integration-notes.md."
        )
