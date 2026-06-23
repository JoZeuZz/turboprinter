# 009 — Quality Stack continuation

## Summary

This continuation stabilizes Project Mode instead of replacing it. The main
changes are deterministic renderer selection, transactional timeline command
validation, safe project asset preview, a usable manual editor MVP, contextual
music API/UI exposure, more cautious license metadata, and conservative Ruff CI.

## Renderer selection

`render_project_from_store()` now loads `render_spec.json` and selects the
renderer from `RenderSpec.renderer` when no renderer is injected explicitly.

- `moviepy` selects `MoviePyTimelineRenderer`.
- `opencut` selects `OpenCutAdapter`.
- OpenCut remains a stub. Its `NotImplementedError` is converted to a failed
  `RenderResult` plus `render_manifest.json`/`render_result.json` with a clear
  warning. A user cannot request OpenCut and silently receive MoviePy.

## Timeline command validation

`TimelineProject.apply_all()` applies command batches on a deep copy, sorts track
items by `start_sec`, validates invariants, and returns the updated timeline only
if validation passes. `TimelineProject.apply()` uses the same path for single
commands and does not mutate the original timeline on validation failure.

Validated invariants:

- no negative `start_sec`, `trim_start_sec`, or non-positive `duration_sec`,
- `trim_start_sec < trim_end_sec` when both trims exist,
- trim range must cover the declared clip duration,
- no initial gaps, internal gaps, or overlaps on video tracks,
- replacement candidates must already exist in the project's media candidate
  registry, carry an explicit matching `segment_id`, match recorded source/path
  metadata, and have an existing `local_path` when a local path is supplied.
  Accepted replacements use `local_path`, `download_url`, then `source_url` as
  the timeline item path.

`POST /api/v1/projects/{project_id}/timeline/commands` saves only the validated
copy. Invalid commands return `400` with the validation message.

`POST /api/v1/projects/{project_id}/timeline/validate` validates the persisted
timeline without mutating it.

## Preview/assets

`GET /api/v1/projects/{project_id}/assets` still lists project-dir files and now
also returns `preview_assets`, a list of referenced project-local assets.

`GET /api/v1/projects/{project_id}/assets/{asset_id:path}` serves only files that:

- are referenced by the timeline, media candidates, selected media, or selected music,
- resolve inside the project directory,
- exist as files,
- pass path traversal checks. Project ids are also rejected if they contain
  absolute paths, separators, or dot segments.

The endpoint never serves an arbitrary client-supplied path.

## Manual editor MVP

`webui/pages/2_Project_Editor.py` now gives a simple manual workflow:

- create/load project,
- view script,
- view ShotPlan segments and queries,
- view video timeline clips with segment/provider/path/timing/trim/query/score,
- queue move up/down, trim, duration, and replace commands,
- save or discard queued commands,
- validate timeline,
- render with `moviepy` or `opencut`,
- view render status,
- select contextual music and volume.

The page uses `webui/project_api.py` and API commands only; it does not edit JSON
directly and does not touch `webui/Main.py`.

## Contextual music

New endpoints:

- `POST /api/v1/projects/{project_id}/music/select`
- `GET /api/v1/projects/{project_id}/music`

Selection accepts manual intent fields (`mood`, `energy`, `tempo`, `style`,
`avoid`) or falls back to `ShotPlan.music_intent` when no manual intent is sent.
If no provider/track matches, the API stores an empty selection and returns
`selected: null` without failing. Selected tracks are persisted to
`selected_music.json`, including volume. `TimelineBuilder.build_from_store()`
uses that selection and `MoviePyTimelineRenderer` passes the music path/volume to
the legacy final mux as `bgm_file`/`bgm_volume`.

## License metadata

`LicenseInfo` can now record license name/URL, source terms URL, usage notes,
training and redistribution restrictions, and provider-specific uncertainty.
Pexels/Pixabay keep traceable terms metadata. Coverr is marked as
`provider_specific` with `unknown_or_provider_specific=true`; it no longer claims
a simplified universal commercial/no-attribution license.

## CI/Ruff

CI now runs on pushes to `main` and `personal/quality-stack`, plus PRs. Ruff is
added as a dev dependency and configured conservatively for syntax/runtime-name
checks only (`E9`, `F821`) to avoid mass formatting or broad lint churn.

## Known risks

- OpenCut is still not implemented; it fails cleanly by design.
- Streamlit preview only works for project-local referenced files. External URLs
  are shown as links.
- Manual reorder is button-based and queues move commands; no drag-and-drop.
- License metadata remains informational. Users must review provider terms before
  publication.
- Ruff config is intentionally narrow; broader lint/type checks remain future work.

## Pending work

- Real OpenCut adapter after license/runtime/design review.
- Richer media preview thumbnails and Range streaming for large project assets.
- More granular timeline validation options if intentional gaps become a product requirement.
- Wider Ruff rule set and optional type checking after existing code is prepared.
