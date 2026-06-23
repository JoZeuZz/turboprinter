from __future__ import annotations

from app.application.services.music_selector import MusicSelector
from app.domain.media.models import LicenseInfo
from app.domain.music.models import MusicTrack
from app.domain.planning.models import MusicIntent


class _Provider:
    name = "fake"

    def __init__(self, tracks):
        self._tracks = tracks

    def is_configured(self):
        return True

    def search(self, intent, max_results):
        return list(self._tracks)


def _intent():
    return MusicIntent(mood="inspirational", energy="medium", style="calm",
                       avoid=["aggressive"])


def test_select_prefers_tag_match():
    tracks = [
        MusicTrack(id="a", provider="local", title="random", tags=["random"]),
        MusicTrack(id="b", provider="local", title="hope", tags=["inspirational", "calm"]),
    ]
    chosen = MusicSelector().select(_intent(), [_Provider(tracks)])
    assert chosen.id == "b"
    assert chosen.score is not None


def test_select_excludes_avoided_tags():
    tracks = [MusicTrack(id="a", provider="local", tags=["aggressive", "inspirational"])]
    assert MusicSelector().select(_intent(), [_Provider(tracks)]) is None


def test_commercial_safe_excludes_unknown_license():
    tracks = [
        MusicTrack(id="a", provider="local", tags=["inspirational"]),  # no license
        MusicTrack(id="b", provider="local", tags=["inspirational"],
                   license=LicenseInfo(type="CC0", commercial_use=True)),
    ]
    chosen = MusicSelector().select(_intent(), [_Provider(tracks)], mode="commercial_safe")
    assert chosen.id == "b"


def test_select_returns_none_without_providers():
    assert MusicSelector().select(_intent(), []) is None


def test_get_music_selector_gated(monkeypatch):
    from app.application.services import music_selector as ms
    monkeypatch.setattr(ms.config, "contextual_music_enabled", False)
    assert ms.get_music_selector() is None
    monkeypatch.setattr(ms.config, "contextual_music_enabled", True)
    assert isinstance(ms.get_music_selector(), ms.MusicSelector)
