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
| GET | `/api/v1/projects/{id}` | project state flags |
| PUT | `/api/v1/projects/{id}` | replace `timeline_project.json` |
| POST | `/api/v1/projects/{id}/plan` | run `ShotPlanner` → `shot_plan.json` |
| POST | `/api/v1/projects/{id}/media/search` | run `MediaAggregator` → candidates + selection |
| POST | `/api/v1/projects/{id}/timeline/build` | `TimelineBuilder.build_from_store` |
| POST | `/api/v1/projects/{id}/timeline/commands` | apply edit commands |
| POST | `/api/v1/projects/{id}/render` | `202`, render in background |
| GET | `/api/v1/projects/{id}/render` | render status |
| GET | `/api/v1/projects/{id}/assets` | list task-dir files |

## Edit commands

`POST /timeline/commands` accepts `{"commands": [...]}` where each command is a
member of the discriminated `EditCommand` union (`app/domain/projects/commands.py`),
selected by the `type` field: `move`, `trim`, `replace`, `set_timing`,
`set_volume`. The handler loads the timeline, calls `TimelineProject.apply()`
per command and persists the result.

## Background render

`POST /render` validates the timeline, builds a `RenderSpec` from
`ExportSettings` + request flags, persists it, and schedules `_run_render` via
FastAPI `BackgroundTasks`. Progress is reported through `app.services.state`
(`sm.state`) using `const.TASK_STATE_PROCESSING|COMPLETE|FAILED`. `GET /render`
returns the current state record. The actual render reuses the Fase 5
`render_project_from_store` workflow (MoviePy renderer by default).

## Store additions

`ProjectStore` gained `project_dir`, `save_script`/`load_script` and `exists`,
so the controller routes all filesystem access through the store. This keeps
tests fully isolated (a tmp-based store) and avoids the `utils.task_dir`
side effect of always creating the directory.

## Out of scope

- Authentication (handled by the reverse proxy hardening of the personal fork).
- Video streaming / preview (assets are listed as relative paths only).
- Distributed render-state persistence (reuses the existing in-memory/Redis state).
