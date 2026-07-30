from __future__ import annotations

from app.infrastructure.media_providers import stock_providers as sp
from app.infrastructure.media_providers.base import material_info_to_candidate
from app.models.schema import MaterialInfo, VideoAspect
from app.utils import utils


def test_material_info_to_candidate_maps_fields():
    info = MaterialInfo()
    info.provider = "pexels"
    info.url = "https://videos.example/v123.mp4?download=1"
    info.duration = 12
    info.width = 1080
    info.height = 1920
    cand = material_info_to_candidate(info, query="lonely sunrise", provider="pexels")
    assert cand.provider == "pexels"
    assert cand.source_url == info.url
    assert cand.download_url == info.url
    assert cand.width == 1080
    assert cand.height == 1920
    assert cand.duration_sec == 12.0
    assert cand.query == "lonely sunrise"
    # id is stable: md5 of url without query string, prefixed
    assert cand.id == "mc-" + utils.md5("https://videos.example/v123.mp4")


def test_material_info_to_candidate_treats_zero_as_unknown():
    info = MaterialInfo()
    info.url = "https://x/y.mp4"
    info.duration = 0
    info.width = 0
    info.height = 0
    cand = material_info_to_candidate(info, query="q", provider="coverr")
    assert cand.width is None
    assert cand.height is None
    assert cand.duration_sec is None


# ---------------------------------------------------------------------------
# Task 3: stock provider adapters
# ---------------------------------------------------------------------------


def _mi(url, dur=10, w=1080, h=1920):
    info = MaterialInfo()
    info.url = url
    info.duration = dur
    info.width = w
    info.height = h
    return info


def test_pexels_provider_search_normalises(monkeypatch):
    captured = {}

    def fake_search(search_term, minimum_duration, video_aspect=VideoAspect.portrait):
        captured["term"] = search_term
        captured["min"] = minimum_duration
        captured["aspect"] = video_aspect
        return [_mi("https://p/1.mp4"), _mi("https://p/2.mp4")]

    monkeypatch.setattr(sp.material, "search_videos_pexels", fake_search)
    provider = sp.PexelsProvider()
    cands = provider.search_videos(
        "sunrise", orientation="portrait", min_duration_sec=3.0, max_results=1
    )
    assert captured["term"] == "sunrise"
    assert captured["min"] == 3
    assert captured["aspect"] == VideoAspect.portrait
    assert len(cands) == 1  # truncated to max_results
    assert cands[0].provider == "pexels"
    assert cands[0].license is not None and cands[0].license.commercial_use is True


def test_pexels_is_configured(monkeypatch):
    monkeypatch.setattr(
        sp.material, "get_api_key", lambda key: "KEY" if key == "pexels_api_keys" else None
    )
    assert sp.PexelsProvider().is_configured() is True
    monkeypatch.setattr(sp.material, "get_api_key", lambda key: None)
    assert sp.PexelsProvider().is_configured() is False


def test_pexels_download_sets_local_path(monkeypatch):
    monkeypatch.setattr(sp.material, "save_video", lambda url, save_dir="": "/tmp/out/vid.mp4")
    provider = sp.PexelsProvider()
    cand = material_info_to_candidate(_mi("https://p/1.mp4"), "q", "pexels")
    out = provider.download(cand, "/tmp/out")
    assert out.local_path == "/tmp/out/vid.mp4"
    assert cand.local_path is None  # original not mutated


def test_coverr_aspect_defaults_to_portrait_on_bad_orientation(monkeypatch):
    captured = {}
    monkeypatch.setattr(
        sp.material, "search_videos_coverr",
        lambda search_term, minimum_duration, video_aspect=VideoAspect.portrait: (
            captured.__setitem__("aspect", video_aspect), []
        )[1],
    )
    sp.CoverrProvider().search_videos("q", orientation="weird")
    assert captured["aspect"] == VideoAspect.portrait


def test_coverr_license_is_provider_specific_not_simplified():
    license_info = sp.CoverrProvider._license

    assert license_info is not None
    assert license_info.unknown_or_provider_specific is True
    assert license_info.type == "provider_specific"
    assert license_info.source_terms_url == "https://coverr.co/license"
    assert not (
        license_info.commercial_use is True
        and license_info.attribution_required is False
    )


def test_stock_provider_licenses_include_terms_metadata():
    pexels = sp.PexelsProvider._license
    pixabay = sp.PixabayProvider._license

    assert pexels.license_name == "Pexels License"
    assert pexels.source_terms_url == "https://www.pexels.com/license/"
    assert pixabay.license_name == "Pixabay Content License"
    assert pixabay.source_terms_url == "https://pixabay.com/service/license-summary/"
