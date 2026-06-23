from __future__ import annotations

import os

from app.domain.media.models import LicenseInfo
from app.domain.music.models import MusicTrack
from app.domain.planning.models import MusicIntent

_AUDIO_EXT = {".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"}


class LocalMusicProvider:
    name = "local"

    def __init__(self, songs_dir: str) -> None:
        self._songs_dir = songs_dir

    def is_configured(self) -> bool:
        return os.path.isdir(self._songs_dir)

    def search(self, intent: MusicIntent, max_results: int) -> list[MusicTrack]:
        if not self.is_configured():
            return []
        tracks: list[MusicTrack] = []
        for entry in sorted(os.listdir(self._songs_dir)):
            stem, ext = os.path.splitext(entry)
            if ext.lower() not in _AUDIO_EXT:
                continue
            tags = [t for t in stem.replace("-", "_").split("_") if t]
            tracks.append(MusicTrack(
                id=f"local:{entry}", provider=self.name,
                local_path=os.path.join(self._songs_dir, entry),
                title=stem, tags=tags,
                license=LicenseInfo(type="local-library"),
            ))
            if len(tracks) >= max_results:
                break
        return tracks
