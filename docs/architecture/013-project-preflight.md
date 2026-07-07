# 013 — Project Preflight

## Summary

Adds a `preflight_check` for project-mode timelines: before rendering (or in
the future, before publishing), the system can now answer "is this video
ready?" with a structured, itemized report instead of discovering problems
mid-render.

## Components

- `app/domain/projects/preflight.py` — `PreflightCheck` (id, passed, severity,
  message) and `PreflightResult` (project_id, valid, errors, warnings,
  summary, checks) Pydantic models. Pure data, no I/O — mirrors
  `validators.py`'s placement in the domain layer.
- `app/application/services/project_preflight.py` — `ProjectPreflightService`,
  constructed with a `ProjectStore`, exposes `.run(task_id) -> PreflightResult`.
  Reuses `validate_item_bounds`/`validate_no_gaps`/`validate_no_overlaps` from
  `validators.py` rather than re-deriving timeline-shape rules.
- `GET /api/v1/projects/{project_id}/preflight` — runs the service, returns
  the full structured result. 404 when project mode is off (via
  `_require_project_mode`), 400 if no timeline has been built yet.
- `POST /api/v1/projects/{project_id}/render` — now runs the same service
  first. Errors always block (400, no override). Warnings block unless
  `RenderRequest.allow_preflight_warnings=true`.

## Checks performed

| Check id | Severity | What it verifies |
|---|---|---|
| `timeline_exists` | error | `timeline_project.json` was found |
| `video_track_exists` | error | at least one video track with items |
| `item_bounds:*` | error | per-item bounds/trim validity (reuses `validate_item_bounds`) |
| `no_gaps:*` / `no_overlaps:*` | error | video track continuity (reuses `validate_no_gaps`/`validate_no_overlaps`) |
| `no_critical_placeholders` | error | no video item has `provider="placeholder"` or a null `local_path` |
| `asset:*` | error | every non-URL `local_path` referenced by any track exists on disk |
| `asset:*:outside_dir` | warning | asset resolves outside `storage/` (informational — local libraries can legitimately live elsewhere; see "Design notes") |
| `narration_present` | error | if `project.script` is non-empty, an audio (non-music) track with an existing asset must exist |
| `subtitles_present` | warning | if the render spec (or its default) wants subtitles, a subtitle track with an existing asset should exist |
| `music_present` | warning | if music was selected (`selected_music.json` non-empty), a music track with an existing asset should exist |
| `export_settings_valid` | error | `width>0`, `height>0`, `1<=fps<=120` |
| `media_not_repeated` | warning | flags `project.metadata["repeated_media_segments"]` when the builder had to stretch a short clip to cover a segment |
| `license_metadata` | warning | video items with a `media_id` should resolve to a `MediaCandidate` with `license.type` set |
| `render_readiness` | — | synthetic summary check, `passed == overall valid` |

## Design notes

- **Errors vs. warnings are deliberately asymmetric.** Errors mean the output
  would be broken or misleading (missing footage, gaps, invalid trims,
  invalid export settings, path traversal) — always block, no override.
  Warnings are quality/completeness signals (no subtitles, no music, no
  license metadata) that a solo operator may knowingly accept — blocked by
  default, but `allow_preflight_warnings=true` proceeds anyway.
- **The "outside storage dir" check is a warning, not an error.** The local
  material library (`README_PERSONAL_FORK.md` §6) can legitimately index
  clips from anywhere on disk (e.g. `/ruta/a/tus/videos`), so a hard error
  here would break a documented, supported workflow. Literal `..` path
  traversal segments are still always an **error** regardless of location —
  that's a different, unconditional risk (a malformed/malicious edit command
  producing a path outside any sane root).
- **Repeated-media and license checks trust `TimelineProject.metadata`/
  `selected_media.json`.** They are only as fresh as the last `TimelineBuilder`
  run — if a timeline is hand-edited via `/timeline/commands` after the fact,
  these two specific checks may go stale. This is a known, accepted
  limitation for this fase (no full editor yet); revisit if manual editing
  grows more powerful.

## Frontend

- `webui-react/src/api/projects.ts` — `projectsApi.preflight(projectId)`.
- `webui-react/src/api/types.ts` — `PreflightCheck`, `PreflightResult`,
  `RenderRequest.allow_preflight_warnings`.
- `webui-react/src/store/useProjectStore.ts` — `preflightResult` state +
  `runPreflight()` action (additive; the existing `render()` action and its
  tests are unchanged).
- `webui-react/src/components/panels/EditorPanel.tsx` — runs preflight when
  the project changes and again right before render; shows a red/amber
  banner for errors/warnings; blocks navigating to the rendering panel when
  `!preflight.valid`; auto-passes `allow_preflight_warnings: true` when only
  warnings are present (this fase intentionally has no separate "confirm
  anyway" dialog — see Fase 1 scope: "no construir un editor visual complejo
  todavía").

## Testing

Backend: `test/domain/test_preflight.py`, `test/services/test_project_preflight.py`
(15 cases covering valid timeline, no timeline, missing asset, placeholder,
gap, overlap, missing narration, missing subtitles, missing music, invalid
export settings, missing/present license metadata, path traversal),
`test/controllers/test_project_preflight_endpoint.py` (endpoint + render
blocking behavior). Frontend: `useProjectStore.test.ts` (new cases for
`runPreflight`), `EditorPanel.test.tsx` (new cases for the banner and render
gating).

## Manual verification

1. `TURBOPRINTER_PROJECT_MODE_ENABLED=true uv run python main.py`
2. Create a project, run plan → media search → narration → timeline build via
   the API or the React editor.
3. `GET /api/v1/projects/{id}/preflight` — inspect the JSON body.
4. Delete or rename one referenced clip on disk, call preflight again —
   confirm it now reports an error for that asset.
5. `POST /api/v1/projects/{id}/render` with a timeline that has warnings
   (e.g. no music selected is fine — that's not a warning; instead remove the
   subtitle track from the timeline JSON) — confirm `400` with a message
   naming the warning, then retry with `{"allow_preflight_warnings": true}`
   and confirm `202`.
6. In the React editor (`webui-react`, `npm run dev`), open a project with a
   missing asset and confirm the red banner appears and the render button
   does not navigate to the rendering panel.
