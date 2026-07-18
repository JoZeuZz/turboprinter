from __future__ import annotations

from app.domain.planning.models import MusicIntent
from app.infrastructure.music_providers.jamendo_provider import JamendoProvider
from app.infrastructure.music_providers.local_music_provider import LocalMusicProvider


def _intent() -> MusicIntent:
    return MusicIntent(mood="inspirational", energy="medium", style="calm")


def test_local_provider_scans_audio_files(tmp_path):
    (tmp_path / "inspirational_calm.mp3").write_bytes(b"x")
    (tmp_path / "aggressive_drums.wav").write_bytes(b"x")
    (tmp_path / "notes.txt").write_text("ignore")
    provider = LocalMusicProvider(songs_dir=str(tmp_path))
    assert provider.is_configured() is True
    tracks = provider.search(_intent(), max_results=10)
    names = {t.title for t in tracks}
    assert "inspirational_calm" in names
    assert all(t.provider == "local" for t in tracks)
    assert "notes" not in names


def test_local_provider_not_configured_when_dir_missing(tmp_path):
    provider = LocalMusicProvider(songs_dir=str(tmp_path / "nope"))
    assert provider.is_configured() is False
    assert provider.search(_intent(), max_results=5) == []


def test_jamendo_stub_not_configured_without_key():
    provider = JamendoProvider(api_key="")
    assert provider.is_configured() is False
    assert provider.search(_intent(), max_results=5) == []
