from __future__ import annotations

from app.domain.media.models import LicenseInfo
from app.domain.music.models import MusicTrack


def test_music_track_minimal_and_roundtrip():
    track = MusicTrack(
        id="m1", provider="local", local_path="/songs/a.mp3",
        title="Hopeful", tags=["inspirational", "calm"], duration_sec=120.0,
        license=LicenseInfo(type="CC0", commercial_use=True),
    )
    assert track.score is None
    assert track.score_reasons == []
    dumped = MusicTrack.model_validate_json(track.model_dump_json())
    assert dumped.tags == ["inspirational", "calm"]
    assert dumped.license.commercial_use is True
