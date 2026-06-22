from __future__ import annotations

from typing import Protocol

from app.domain.media.models import LicenseInfo, MediaCandidate
from app.models.schema import MaterialInfo
from app.utils import utils


class MediaProvider(Protocol):
    name: str

    def is_configured(self) -> bool: ...

    def search_videos(
        self,
        query: str,
        orientation: str | None = None,
        min_duration_sec: float | None = None,
        max_results: int = 20,
    ) -> list[MediaCandidate]: ...

    def download(self, candidate: MediaCandidate, target_dir: str) -> MediaCandidate: ...


def material_info_to_candidate(
    info: MaterialInfo,
    query: str,
    provider: str,
    license_info: LicenseInfo | None = None,
) -> MediaCandidate:
    """Normalise a legacy MaterialInfo into a domain MediaCandidate.

    width/height/duration of 0 are treated as "unknown" (None), matching how the
    upstream ranker interprets the legacy defaults.
    """
    url = info.url or ""
    base = url.split("?")[0] if url else f"{provider}:{query}"
    return MediaCandidate(
        id="mc-" + utils.md5(base),
        provider=provider,
        source_url=url or None,
        download_url=url or None,
        width=info.width or None,
        height=info.height or None,
        duration_sec=float(info.duration) if info.duration else None,
        query=query,
        license=license_info,
    )
