from app.domain.media.models import LicenseInfo, MediaCandidate


def test_media_candidate_minimal():
    c = MediaCandidate(id="m1", provider="pexels")
    assert c.local_path is None
    assert c.tags == []
    assert c.score_reasons == []


def test_media_candidate_roundtrip():
    c = MediaCandidate(
        id="m1",
        provider="pexels",
        download_url="https://example/v.mp4",
        width=1080,
        height=1920,
        duration_sec=8.0,
        license=LicenseInfo(type="pexels", commercial_use=True),
        score=0.91,
        score_reasons=["query match", "good duration"],
        segment_id="seg_001",
    )
    raw = c.model_dump_json()
    back = MediaCandidate.model_validate_json(raw)
    assert back == c
    assert back.license.type == "pexels"
