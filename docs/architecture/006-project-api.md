# 006 — Project-mode REST API

> Fase 6 of the project-mode evolution (see `plans/spec/spec-001.md`). Standalone,
> opt-in, additive. Legacy endpoints (`video`, `llm`) and the legacy pipeline are
> untouched.

## Overview

`app/controllers/v1/projects.py` exposes the Fase 1-5 pipeline over REST under
`/api/v1/projects`. Handlers are thin: they delegate to `ShotPlanner`,
`MediaAggregator`, `TimelineBuilder`, the `render_project` workflow and
`FilesystemProjectStore`. No business logic lives in the controller.

- **`project_id == task_id`.** Everything is persisted under the project store
  task dir (`storage/tasks/{task_id}/`) via `FilesystemProjectStore`.
- **Gating.** Every endpoint returns `404` when
  `config.project_mode_enabled` (`TURBOPRINTER_PROJECT_MODE_ENABLED`) is false.
- **Schemas** live in `app/models/project_schema.py` (kept out of the large
  `app/models/schema.py`).
- **Errors** use `app.models.exception.HttpException`, translated to JSON by the
  handler already registered in `app/asgi.py`.

## Endpoints

| Method | Path | Action |
|--------|------|--------|
| POST | `/api/v1/projects/from-topic` | create project; optional LLM script generation |
| POST | `/api/v1/projects/from-script` | create project from pasted script |
| POST | `/api/v1/projects/from-reddit` | create project from a Reddit thread/manual payload (Fase 9; `404` if reddit ingest off) |
| GET | `/api/v1/projects/{id}` | project state flags plus script/plan/timeline/media/music payloads for editor use |
| PUT | `/api/v1/projects/{id}` | replace `timeline_project.json` |
| POST | `/api/v1/projects/{id}/plan` | run `ShotPlanner` → `shot_plan.json` |
| POST | `/api/v1/projects/{id}/media/search` | run `MediaAggregator` → candidates + selection |
| POST | `/api/v1/projects/{id}/timeline/build` | `TimelineBuilder.build_from_store` |
| POST | `/api/v1/projects/{id}/timeline/commands` | apply edit commands |
| POST | `/api/v1/projects/{id}/timeline/validate` | validate persisted timeline invariants |
| POST | `/api/v1/projects/{id}/music/select` | select contextual music from manual or ShotPlan intent |
| GET | `/api/v1/projects/{id}/music` | read `selected_music.json` |
| POST | `/api/v1/projects/{id}/render` | `202`, render in background |
| GET | `/api/v1/projects/{id}/render` | render status |
| GET | `/api/v1/projects/{id}/assets` | list task-dir files + previewable assets |
| GET | `/api/v1/projects/{id}/assets/{asset_id}` | serve a referenced project-local asset |

## Edit commands

`POST /timeline/commands` accepts `{"commands": [...]}` where each command is a
member of the discriminated `EditCommand` union (`app/domain/projects/commands.py`),
selected by the `type` field: `move`, `trim`, `replace`, `set_timing`,
`set_volume`. The handler loads the timeline, calls `TimelineProject.apply_all()`
on a deep copy, validates the final timeline, and persists only if every command
passes. Invalid command batches return `400` and the original
`timeline_project.json` remains unchanged.

For `replace`, the API also verifies that the replacement candidate already
exists in the project's media candidate/selected-media registry, carries an
explicit matching `segment_id`, and does not alter the recorded source/path
metadata. This prevents clients from injecting arbitrary server-local paths or
cross-segment media into `timeline_project.json`. When accepted, replace uses the
same media path fallback as timeline build: `local_path`, then `download_url`,
then `source_url`.

`POST /timeline/validate` runs the same invariant checks without mutating the
timeline. Current checks reject non-positive duration, negative starts/trims,
invalid trim ranges, trim spans shorter than declared duration, gaps, and overlaps
on video tracks.

## Background render

`POST /render` accepts a `RenderRequest` body with:

- `renderer`: `"moviepy" | "opencut" | null` — null preserves the value stored
  in `render_spec.json`; explicit values override it. The Project Editor UI
  exposes this as a selectbox with options "preservar / moviepy / opencut".
- `include_subtitles`: bool (default `true`)
- `include_background_music`: bool (default `true`)

The handler validates the timeline, builds a `RenderSpec`, persists it, and
schedules `_run_render` via FastAPI `BackgroundTasks`. Progress is reported
through `app.services.state` (`sm.state`) using
`const.TASK_STATE_PROCESSING|COMPLETE|FAILED`. `GET /render` returns the current
state record. The actual render reuses the Fase 5 `render_project_from_store`
workflow, which reads `render_spec.json` and selects the requested renderer.
`opencut` remains a stub and records a controlled failed render result/manifest
instead of silently falling back to MoviePy.

## Assets / preview

`GET /assets` preserves the original relative file list in `assets` and adds
`preview_assets` for files that are safe to serve. `GET /assets/{asset_id}` only
serves files that are referenced by the timeline/media/music state, resolve inside
the project directory, and exist on disk. Path traversal (`..`, absolute paths, or
escaped separators) is rejected for both `project_id` and `asset_id`.

## Contextual music

`POST /music/select` accepts manual intent fields (`mood`, `energy`, `tempo`,
`style`, `avoid`) plus `commercial_safe_only`, `local_only`, and `volume`. If no
manual intent is sent, it uses `ShotPlan.music_intent` when available. No matching
music is a successful empty result (`selected: null`). Successful selections are
saved to `selected_music.json`. `GET /music` returns that persisted list.

## Store additions

`ProjectStore` gained `project_dir`, `save_script`/`load_script` and `exists`,
so the controller routes all filesystem access through the store. This keeps
tests fully isolated (a tmp-based store) and avoids the `utils.task_dir`
side effect of always creating the directory.

## Out of scope

- Authentication (handled by the reverse proxy hardening of the personal fork).
- Rich streaming/thumbnail preview. Current preview serves only safe project-local files.
- Distributed render-state persistence (reuses the existing in-memory/Redis state).
