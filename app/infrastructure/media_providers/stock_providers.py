from __future__ import annotations

from app.domain.media.models import LicenseInfo, MediaCandidate
from app.infrastructure.media_providers.base import MediaProvider, material_info_to_candidate
from app.models.schema import VideoAspect
from app.services import material


def _aspect(orientation: str | None) -> VideoAspect:
    try:
        return VideoAspect[orientation] if orientation else VideoAspect.portrait
    except KeyError:
        return VideoAspect.portrait


class _StockProvider(MediaProvider):
    name = ""
    _api_key_cfg = ""
    _search_fn_name = ""
    _license: LicenseInfo | None = None

    def is_configured(self) -> bool:
        return bool(material.get_api_key(self._api_key_cfg))

    def search_videos(
        self,
        query: str,
        orientation: str | None = None,
        min_duration_sec: float | None = None,
        max_results: int = 20,
    ) -> list[MediaCandidate]:
        search_fn = getattr(material, self._search_fn_name)
        items = search_fn(
            search_term=query,
            minimum_duration=int(min_duration_sec or 0),
            video_aspect=_aspect(orientation),
        )
        return [
            material_info_to_candidate(info, query, self.name, self._license)
            for info in items[:max_results]
        ]

    def download(self, candidate: MediaCandidate, target_dir: str) -> MediaCandidate:
        path = material.save_video(candidate.download_url, target_dir)
        return candidate.model_copy(update={"local_path": path})


class PexelsProvider(_StockProvider):
    name = "pexels"
    _api_key_cfg = "pexels_api_keys"
    _search_fn_name = "search_videos_pexels"
    _license = LicenseInfo(
        type="pexels",
        commercial_use=True,
        attribution_required=False,
        license_name="Pexels License",
        license_url="https://www.pexels.com/license/",
        source_terms_url="https://www.pexels.com/license/",
        usage_notes="Pexels license metadata; review current source terms before publication.",
        redistribution_restricted=True,
    )


class PixabayProvider(_StockProvider):
    name = "pixabay"
    _api_key_cfg = "pixabay_api_keys"
    _search_fn_name = "search_videos_pixabay"
    _license = LicenseInfo(
        type="pixabay",
        commercial_use=True,
        attribution_required=False,
        license_name="Pixabay Content License",
        license_url="https://pixabay.com/service/license-summary/",
        source_terms_url="https://pixabay.com/service/license-summary/",
        usage_notes=(
            "Pixabay content-license metadata; review current source terms before publication."
        ),
        redistribution_restricted=True,
    )


class CoverrProvider(_StockProvider):
    name = "coverr"
    _api_key_cfg = "coverr_api_keys"
    _search_fn_name = "search_videos_coverr"
    _license = LicenseInfo(
        type="provider_specific",
        commercial_use=None,
        attribution_required=None,
        license_name="Coverr provider-specific terms",
        license_url="https://coverr.co/license",
        source_terms_url="https://coverr.co/license",
        source_url="https://coverr.co/license",
        usage_notes=(
            "Coverr terms are provider-specific. Review current Coverr license and API "
            "terms before commercial use or redistribution."
        ),
        redistribution_restricted=True,
        unknown_or_provider_specific=True,
    )
