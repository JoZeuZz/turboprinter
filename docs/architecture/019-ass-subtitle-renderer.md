# 019 — ASS Subtitle Renderer (opt-in)

## Motivation

`subtitle_styles.py` already resolves premium subtitle presets (rounded background, karaoke word-highlight) but the rounded background is rendered today via MoviePy/PIL compositing, and word-highlight render was left as a documented follow-up. A community fork (`origin/feat/logs-and-video-settings`, unrelated git history, Node/TS rewrite) independently solved the same problem using a native `.ass` file burned via FFmpeg's `subtitles=` filter: a two-layer vector-drawn rounded box plus native ASS animation tags (pop/fade/rotate). This doc adopts that *technique* — reimplemented in Python — as an opt-in alternate renderer, without touching the existing MoviePy path or adopting the fork's Node stack.

Explicitly out of scope: GPU encoder auto-detection, reusable presets, structured logging, material-selection fixes, YouTube upload UI. Those are separate sub-projects.

## Architecture

MoviePy still assembles the visual timeline (crop/resize/concat) and `app/services/quality/ffmpeg_mux.py` still performs the single final FFmpeg pass that muxes voice + BGM. This design adds one more optional filter to that same pass instead of a new pass, and it makes MoviePy skip subtitle compositing when the ASS path is active.

```
subtitle_path (.srt)
        │
        ▼
 parse cues (existing SRT parsing)
        │
        ▼ (if subtitle_dynamic_chunking)
 subtitle_chunking.split_dynamic_chunks()   ── new, pure
        │
        ▼
 ass_subtitles.generate_ass()               ── new, pure
        │
        ▼
 write .ass to output_dir
        │
        ▼
 ffmpeg_mux.finalize(subtitles_ass_path=...) ── extended
        │
        ▼
 single FFmpeg pass: mux audio + burn subtitles + encode
```

When `quality_settings.subtitle_renderer != "ass"` (default `"moviepy"`, or quality disabled), none of the above runs — `video.py` keeps building `SubtitlesClip`/`CompositeVideoClip` exactly as today.

## Components

### `app/services/quality/subtitle_chunking.py` (new, pure)

`split_dynamic_chunks(text, start_sec, duration_sec, max_units=3) -> list[dict]`

Groups text into short TikTok-style cues (2-3 words, or characters for CJK text), each with proportional `start`/`duration`. A trailing group of a single unit is merged into the previous group instead of appearing alone. Ported from the fork's `splitTextIntoTikTokSubtitles`.

### `app/services/quality/ass_subtitles.py` (new, pure)

`generate_ass(cues, video_width, video_height, subtitle_render: SubtitleRenderSettings, animation: str) -> str`

Builds a full `.ass` document:
- `cssHexToAss`-equivalent hex→BGR conversion with inverted alpha (ASS alpha is 00=opaque, FF=transparent).
- Rounded-rect background drawn as a bézier vector path (`kappa = 0.5522847498`) on Layer 0, positioned with `\an7\pos(boxX,boxY)` (top-left anchor).
- Foreground text on Layer 1, positioned with `\an8\pos(centerX,textY)` (top-center anchor) — the two-layer top-left/top-center split is what gives Esteban's fork pixel-accurate centering after 15+ iterations chasing the same bug; reused as-is.
- Animation override tags: `pop` (`\fscx\fscy` bounce via `\t()`), `fade` (`\fad()`), `rotate` (`\frz` + scale via `\t()`). `"none"` emits no tags — visually identical to a static box.

### `app/services/video.py` (wiring)

When `subtitle_renderer == "ass"`: skip the `SubtitlesClip` → `build_subtitle_text_clip` → `CompositeVideoClip` block, parse the existing SRT cues, optionally chunk them, generate and write the `.ass` file, and pass its path to `ffmpeg_mux.finalize`.

### `app/services/quality/ffmpeg_mux.py` (extended)

`finalize`/`_build_command` gain optional `subtitles_ass_path` and `fonts_dir` params. When set, `-vf "subtitles=<escaped path>:fontsdir=<escaped dir>"` is appended to the existing single-pass command. A path-escaping helper handles colons/backslashes, which otherwise break FFmpeg's `subtitles=` filter argument parsing.

### `QualitySettings` (extended)

Three new tolerant fields, all defaulting to current behavior when absent from `config.toml`:
- `subtitle_renderer: "moviepy" | "ass"` (default `"moviepy"`)
- `subtitle_animation: "none" | "pop" | "fade" | "rotate"` (default `"none"`)
- `subtitle_dynamic_chunking: bool` (default `False`)

## Error Handling

If the `subtitles=` filter fails at the FFmpeg step (corrupt `.ass`, missing fontconfig), the existing `fallback_fn` (`_moviepy_fallback`) still runs and produces a valid video — but **without subtitles**, since MoviePy never composited them in ASS mode. This mirrors the existing codec-fallback contract (never crash, degrade gracefully) but is a real, silent degradation worth calling out. It is logged at ERROR level with an explicit message ("ASS subtitle burn failed — output has no subtitles") so it is never a silent loss.

When quality is disabled or `subtitle_renderer` is `"moviepy"`, behavior is byte-for-byte identical to today — same guarantee already covered by the `_mirror_params` parity tests.

## Testing

- `test/services/test_quality_subtitle_chunking.py` — CJK detection, orphan-group merge, proportional timing, empty text.
- `test/services/test_quality_ass_subtitles.py` — golden-string assertions on generated `.ass` (rounded-rect path values, color conversion, animation tags per type, alignment/position variants, no-background case).
- `test/services/test_quality_ffmpeg_mux.py` (extended) — `-vf subtitles=...` present/absent correctly, path escaping.
- `test/services/test_video.py` (extended) — ASS mode skips MoviePy subtitle compositing; default mode has zero behavioral diff (regression guard).

## Not Included

- GPU encoder auto-detection.
- Reusable presets.
- Structured pipeline logging.
- Material-selection (Pexels/local video) fixes.
- YouTube upload UI / niche automation.
- Adopting any code, dependency, or history from the Node/TS fork — only the ASS-generation technique is reimplemented in Python.
