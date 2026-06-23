# 007 — Contextual music

> Fase 8 of the project-mode evolution (see `plans/spec/spec-001.md`). Standalone,
> opt-in, additive. The legacy BGM path (`video.get_bgm_file`/`generate_video`)
> is untouched when the flag is off.

## Overview

```text
MusicIntent (from ShotPlanner)
   -> MusicProvider.search()    (local library, Jamendo stub)
   -> MusicSelector.select()    (tag/mood heuristic + licence filter)
   -> MusicTrack
   -> selected_music.json       (ProjectStore)
```

- `app/domain/music/models.py` — `MusicTrack` (reuses `LicenseInfo` from media).
- `app/infrastructure/music_providers/` — `MusicProvider` protocol,
  `LocalMusicProvider` (scans an audio dir; tags derived from filename),
  `JamendoProvider` (stub, no network without an API key).
- `app/application/services/music_selector.py` — `MusicSelector.select(intent,
  providers, mode)` and `get_music_selector()` factory gated by the flag.
- `ProjectStore.save_selected_music/load_selected_music` → `selected_music.json`.

## Selection heuristic

Each candidate's tags are matched against the intent's `mood`/`energy`/`style`.
Tracks carrying any `avoid` tag are dropped. The highest tag-match count wins;
ties keep the first seen (deterministic). Score and reasons are recorded on the
chosen `MusicTrack`.

## Modes & licence

- `local_only` (default) — any local track is eligible.
- `commercial_safe` — tracks without a known `license.type` are excluded
  (treated as `license_unknown`).

Licence/source is always recorded: `LocalMusicProvider` tags tracks as
`local-library`; a real Jamendo implementation must record the Jamendo licence
and source URL.

## Timeline & render (wired)

`TimelineBuilder.build(..., music_track=...)` appends a `music_1` audio track
(type `audio`, with `volume`), and `build_from_store` loads the first track from
`selected_music.json`. The MoviePy renderer separates `music_1` from the
narration track in `_resolve_render_inputs` and, when
`RenderSpec.include_background_music` is set, passes the music path/volume as
`params.bgm_file`/`params.bgm_volume` into the legacy `generate_video` mix
(volume + fade), so narration is not covered.

## Flag

`TURBOPRINTER_CONTEXTUAL_MUSIC` (default `false`). Without the flag (or without a
local library), the legacy BGM behaviour is unchanged.

## Out of scope

- AI music generation.
- Real Jamendo download (stub only).
- Beat-syncing / ducking beyond the existing volume + fade.
