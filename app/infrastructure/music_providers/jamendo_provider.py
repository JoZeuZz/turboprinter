from __future__ import annotations

from app.domain.music.models import MusicTrack
from app.domain.planning.models import MusicIntent


class JamendoProvider:
    """Optional Jamendo provider. Stub until an API key is configured.

    Returns no results without a key; a real implementation would query the
    Jamendo API and record licence/source on each MusicTrack.
    """

    name = "jamendo"

    def __init__(self, api_key: str = "") -> None:
        self._api_key = api_key

    def is_configured(self) -> bool:
        return bool(self._api_key)

    def search(self, intent: MusicIntent, max_results: int) -> list[MusicTrack]:
        return []  # stub: no network until implemented
