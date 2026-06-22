from __future__ import annotations

from app.models.schema import MaterialInfo
from app.infrastructure.media_providers.base import material_info_to_candidate
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
