from __future__ import annotations

from typing import Protocol

from app.domain.music.models import MusicTrack
from app.domain.planning.models import MusicIntent


class MusicProvider(Protocol):
    name: str

    def is_configured(self) -> bool: ...

    def search(self, intent: MusicIntent, max_results: int) -> list[MusicTrack]: ...
