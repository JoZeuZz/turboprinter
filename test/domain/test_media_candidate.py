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


def test_license_info_extended_metadata_roundtrip():
    license_info = LicenseInfo(
        type="provider_specific",
        commercial_use=None,
        attribution_required=None,
        license_name="Provider terms",
        license_url="https://example.com/license",
        usage_notes="Review source terms before publication.",
        source_terms_url="https://example.com/terms",
        training_restricted=True,
        redistribution_restricted=True,
        unknown_or_provider_specific=True,
    )

    raw = license_info.model_dump_json()
    back = LicenseInfo.model_validate_json(raw)

    assert back.license_name == "Provider terms"
    assert back.source_terms_url == "https://example.com/terms"
    assert back.training_restricted is True
    assert back.redistribution_restricted is True
    assert back.unknown_or_provider_specific is True
