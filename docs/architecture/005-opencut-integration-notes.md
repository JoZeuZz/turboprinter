# 005 — Render from TimelineProject & OpenCut integration notes

> Fase 5 of the project-mode evolution (see `plans/spec/spec-001.md`). Standalone,
> opt-in, additive. The legacy render path (`app/services/task.py` →
> `video.combine_videos` / `video.generate_video`) is untouched.

## Render-from-timeline architecture

```text
TimelineProject + RenderSpec
        ↓  MoviePyTimelineRenderer.render()
_concat_timeline_clips()        # honours per-item trim_start/trim_end/duration
        ↓                        # missing local_path → black ColorClip
combined.mp4 (silent)
        ↓  video.generate_video(combined, narration, srt, output, params)
final.mp4                        # subtitles burn + BGM mix + audio mux (legacy)
        ↓
render_manifest.json + render_result.json   (persisted via ProjectStore)
```

Modules:

- `app/infrastructure/renderers/base.py` — `TimelineRenderer` Protocol (`name`, `render(project, spec, output_dir) -> RenderResult`).
- `app/infrastructure/renderers/moviepy_renderer.py` — `MoviePyTimelineRenderer` (default). Pure helpers `_resolve_render_inputs`, `_build_video_params`, `_aspect_for` are unit-tested; the moviepy-heavy `_concat_timeline_clips` and the legacy `video.generate_video` are monkeypatched in tests.
- `app/infrastructure/renderers/opencut_adapter.py` — `OpenCutAdapter` stub.
- `app/application/workflows/render_project.py` — `get_timeline_renderer()` factory (gated by `TURBOPRINTER_PROJECT_MODE_ENABLED` + `TURBOPRINTER_TIMELINE_RENDERER`) and `render_project_from_store()`.

`render_project_from_store()` reads persisted `render_spec.json` and selects the
renderer from `RenderSpec.renderer` when no renderer is injected. This keeps API
requests deterministic: `renderer="moviepy"` uses MoviePy and
`renderer="opencut"` uses `OpenCutAdapter`.

The domain layer (`app/domain/`) never imports moviepy or `VideoParams`. That
coupling lives only in `app/infrastructure/renderers/`.

## Why hybrid (concat + legacy mux)

- The legacy `video.combine_videos` **re-slices** clips to fill the narration
  audio length using `max_clip_duration` and the concat mode. It deliberately
  **discards** the timeline's per-item trims/durations, so it cannot be the base
  of a deterministic timeline render.
- A fresh `_concat_timeline_clips` honours each `TimelineItem`'s
  `trim_start_sec` / `trim_end_sec` / `duration_sec` and order, keeping the
  timeline as the source of truth.
- `video.generate_video` already handles subtitle burn, background-music mixing
  and the final audio mux with codec fallback / render profiles. Reusing it
  avoids re-implementing tested, fiddly logic and keeps output consistent with
  the legacy path.

Target dimensions are derived from `ExportSettings`/`RenderSpec` via `_aspect_for`
(`(1920,1080)→landscape`, `(1080,1920)→portrait`, `(1080,1080)→square`, else
`portrait`); the concat builds at `aspect.to_resolution()` so it stays consistent
with what `generate_video` assumes.

## Known limitation

`_concat_timeline_clips` does **not** loop video to fill an item longer than its
source segment; it caps at `min(trim_end, source.duration, start + duration)`.
Full coverage relies on the Fase 4 `TimelineBuilder`, which repeats short
candidates across contiguous items (tracked in
`metadata["repeated_media_segments"]`). Items with no usable media become black
placeholder clips. End-to-end render with real video files is validated manually;
unit tests monkeypatch the moviepy/ffmpeg path.

## OpenCut

[OpenCut](https://github.com/OpenCut-app/OpenCut) is an open-source video editor.
This fork treats it as a **source of patterns, not a dependency**.

Concepts adopted (already reflected in the architecture):

- Timeline as the single source of truth for both auto and manual flows.
- Explicit, small edit commands (`MoveClip`, `TrimClip`, `ReplaceClip`,
  `SetClipTiming`, `SetClipVolume`) applied to the project.
- Non-destructive preview (edits mutate the timeline, not the media).
- Render observable by stage / separation between editor, media manager and
  renderer (the `TimelineRenderer` interface).

What is **not** done:

- No OpenCut code is vendored or copied. `OpenCutAdapter.render` raises
  `NotImplementedError`.
- The workflow catches that specific not-implemented failure and persists a clear
  failed `render_result.json`/`render_manifest.json`; it does not fall back to
  MoviePy silently.

Risks before any real integration:

- **Licence**: review OpenCut's licence and component licences before vendoring
  or copying any code; document exactly what is copied and why it is safe.
- **Integration/runtime**: OpenCut is a web/TS editor; a real renderer would
  need a defined runtime (headless service, exported render engine, or a
  reimplementation), well outside the scope of a minimal first cut.
- **Format mapping**: a bidirectional `TimelineProject ↔ OpenCut project`
  mapping must be specified and tested.

What must happen to enable a real OpenCut renderer:

1. Licence clearance + a written note of what is reused.
2. A chosen, reproducible render runtime.
3. A `TimelineProject ↔ OpenCut` format adapter with tests.
4. Implement `OpenCutAdapter.render` behind the existing `TimelineRenderer`
   interface; select it via `TURBOPRINTER_TIMELINE_RENDERER=opencut`.

Until then, `moviepy` is the only functional renderer.

## Flags

- `TURBOPRINTER_PROJECT_MODE_ENABLED` (default `false`) — gates the renderer
  factory and manifest/result persistence.
- `TURBOPRINTER_TIMELINE_RENDERER` (default `moviepy`) — `moviepy` | `opencut`.
