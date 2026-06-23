from __future__ import annotations

from app.config import config
from app.domain.music.models import MusicTrack
from app.domain.planning.models import MusicIntent


def _license_known(track: MusicTrack) -> bool:
    return track.license is not None and bool(track.license.type)


class MusicSelector:
    def select(
        self, intent: MusicIntent, providers, mode: str = "local_only"
    ) -> MusicTrack | None:
        wanted = {t.lower() for t in [intent.mood, intent.energy, intent.style] if t}
        avoid = {a.lower() for a in intent.avoid}
        best: MusicTrack | None = None
        for provider in providers:
            if not provider.is_configured():
                continue
            for track in provider.search(intent, max_results=20):
                tags = {t.lower() for t in track.tags}
                if tags & avoid:
                    continue
                if mode == "commercial_safe" and not _license_known(track):
                    continue
                matches = len(tags & wanted)
                if matches == 0:
                    continue
                reasons = [f"tag match: {sorted(tags & wanted)}"]
                scored = track.model_copy(update={
                    "score": float(matches), "score_reasons": reasons,
                })
                if best is None or (scored.score or 0) > (best.score or 0):
                    best = scored
        return best


def get_music_selector() -> "MusicSelector | None":
    if not getattr(config, "contextual_music_enabled", False):
        return None
    return MusicSelector()
