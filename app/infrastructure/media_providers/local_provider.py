from __future__ import annotations

import os

from app.domain.media.models import LicenseInfo, MediaCandidate
from app.services.quality import local_library
from app.services.quality.library_cli import _default_db_path

_VALID_ORIENTATIONS = {"portrait", "landscape", "square"}


class LocalLibraryProvider:
    name = "local"

    def __init__(self, db_path: str | None = None) -> None:
        self._db_path = db_path or _default_db_path()

    def is_configured(self) -> bool:
        return os.path.exists(self._db_path)

    def search_videos(
        self,
        query: str,
        orientation: str | None = None,
        min_duration_sec: float | None = None,
        max_results: int = 20,
    ) -> list[MediaCandidate]:
        if not self.is_configured():
            return []
        orient = orientation if orientation in _VALID_ORIENTATIONS else None
        conn = local_library.connect(self._db_path)
        try:
            entries = local_library.query_entries(
                conn, media_type="video", orientation=orient
            )
        finally:
            conn.close()
        minimum = min_duration_sec or 0.0
        out: list[MediaCandidate] = []
        for e in entries:
            if e.duration and e.duration < minimum:
                continue
            out.append(MediaCandidate(
                id="mc-local-" + (e.hash[:12] if e.hash else local_library.compute_file_hash(e.path)[:12]),
                provider="local",
                local_path=e.path,
                width=e.width or None,
                height=e.height or None,
                duration_sec=e.duration or None,
                fps=e.fps or None,
                query=query,
                tags=list(e.tags),
                license=LicenseInfo(type=e.license) if e.license else None,
            ))
        return out[:max_results]

    def download(self, candidate: MediaCandidate, target_dir: str) -> MediaCandidate:
        return candidate
