# 014 — Workspaces (Content Automation Lab, Fase 2)

## Summary

Adds `Workspace`, the first persistent business entity of the Content
Automation Lab roadmap (`docs/design/context.md`): a channel, niche, or
editorial line (e.g. "Canal Curiosidades", "Reddit Stories ES") with its own
default language, voice, subtitle style, visual style, music profile, and
(for later fases) prompt template reference, upload schedule, and
monetization policy. Projects can optionally reference a workspace by id.

## What problem this solves

Before this fase, every project was created from scratch with no notion of
"this belongs to my curiosities channel" vs "this belongs to my Reddit
stories channel" — any per-channel defaults (voice, style, language) had to
be re-entered by hand every time. A `Workspace` is a reusable configuration
bucket. It does **not** yet do anything on its own — no scheduler, no
publishing, no metrics (those are later fases: 5, 6, 7). Right now it is
purely a labeled bag of defaults a project can optionally point at.

## Naming note (read this before touching frontend workspace code)

This codebase already had an unrelated "workspace" concept in the React
frontend before this fase: `useProjectWorkspaceStore.ts`,
`pages/Workspace.tsx`, `components/layout/WorkspaceLayout.tsx`, and the
`nav.workspace` i18n key — all of which mean "the screen where you edit the
currently-open project" (Spanish UI label: "Espacio"). None of those were
touched by this fase. The new business entity added here uses different
frontend names on purpose: store `useWorkspacesStore.ts` (plural), page
`pages/Workspaces.tsx`, route `/workspaces`, nav label **"Canales"/
"Channels"** — while the backend API, domain model, and TypeScript types are
still named `Workspace`/`workspaces` to match the REST contract. If you're
looking for "the workspace the user is currently editing," that's the
pre-existing `useProjectWorkspaceStore`. If you're looking for "the list of
channels/editorial lines," that's `useWorkspacesStore` from this fase.

## Persistence

`WorkspaceStore` (`app/infrastructure/storage/workspace_store.py`) writes one
JSON file per workspace at `storage/workspaces/<id>.json` — flat, no
subdirectories, since a workspace has no large sub-artifacts (unlike a
project, which owns a script, timeline, media candidates, etc. under
`storage/tasks/<id>/`). This mirrors `FilesystemProjectStore`'s
save/load/list pattern closely enough that migrating to a real database in
Fase 4 (`docs/design/context.md` §23) should mean swapping the store
implementation behind the same five-method interface
(`save`/`load`/`list`/`delete`/`exists`), not touching callers.

## Endpoints

All under `/api/v1/workspaces`, gated by `TURBOPRINTER_WORKSPACES_ENABLED`
(default off; 404 when off, independent of `TURBOPRINTER_PROJECT_MODE_ENABLED`
— you can enable workspaces without enabling project mode, though they're
only useful together right now):

| Method | Path | Behavior |
|---|---|---|
| GET | `/workspaces` | List all, sorted by `updated_at` descending |
| POST | `/workspaces` | Create; `400` if `name` is blank |
| GET | `/workspaces/{id}` | Get one; `404` if missing |
| PUT | `/workspaces/{id}` | Full replace, keeps `id`/`created_at`, bumps `updated_at`; `404` if missing, `400` if `name` blank |
| DELETE | `/workspaces/{id}` | `404` if missing |

No FK integrity is enforced: a project's `workspace_id` is not validated
against `WorkspaceStore` at creation time, and deleting a workspace does not
touch or block projects that reference it. This is an intentional
simplification for this fase — revisit if/when workspaces gain enough
downstream effect (scheduling, publishing) that a dangling reference becomes
a real problem rather than a labeling inconsistency.

## Relation to project mode

`workspace_id` is a new optional field on `CreateFromTopicRequest`,
`CreateFromScriptRequest`, and `CreateFromRedditRequest`
(`app/models/project_schema.py`), persisted into the existing
`project.json` metadata file
(`FilesystemProjectStore.save_project_metadata`) and surfaced back on
`GET /projects/{id}` as `workspace_id`. Projects created without a
`workspace_id` behave exactly as before this fase — workspaces are strictly
additive to project mode, not a prerequisite for it.

## Future relation to scheduler / publication / metrics

Per `docs/design/context.md`'s target architecture, `Workspace` is the
anchor entity later fases attach to:

- Fase 3 (`PromptTemplate`) will let a workspace's `prompt_template_id`
  actually resolve to something.
- Fase 5 (scheduler) will read `upload_schedule` and `enabled` to decide
  when to run a workspace's next generation job.
- Fase 6 (`Publication`) will use `platform`/`channel_ref` to know where to
  upload.
- Fase 7 (`MetricsSnapshot`) will roll up performance per workspace so the
  system can compare "Canal Curiosidades" against "Misterio Shorts."

None of that exists yet. This fase only builds the labeled bucket.

## Frontend

- `webui-react/src/api/workspaces.ts` — `workspacesApi` client.
- `webui-react/src/api/types.ts` — `Workspace`, `WorkspaceUpsertRequest`
  types; `workspace_id` added to `CreateFromTopicRequest`,
  `CreateFromScriptRequest`, `CreateFromRedditRequest`, and
  `GetProjectResponse`.
- `webui-react/src/store/useWorkspacesStore.ts` — list/create/update/delete.
- `webui-react/src/pages/Workspaces.tsx` — list + inline create/edit form,
  routed at `/workspaces`, nav icon labeled "Canales"/"Channels".
- `webui-react/src/components/panels/ScriptPanel.tsx` — gains an optional
  workspace `<Select>`; picking one passes `workspace_id` into
  `createFromScript` and prefills the script language from the workspace's
  `language` default. Deeper default propagation (voice, subtitle style,
  visual style) is left for a later fase — this one only wires the
  association and the single lowest-risk default (language).

## Testing

Backend: `test/domain/test_workspace.py`, `test/infrastructure/test_workspace_store.py`,
`test/controllers/test_workspaces_endpoints.py` (full CRUD + disabled-flag
404), plus association tests in `test/infrastructure/test_project_store.py`
and `test/services/test_project_endpoints.py`. Frontend:
`useWorkspacesStore.test.ts`, `Workspaces.test.tsx`, and a `ScriptPanel.test.tsx`
case for the workspace selector.

## Manual verification

1. `TURBOPRINTER_PROJECT_MODE_ENABLED=true TURBOPRINTER_WORKSPACES_ENABLED=true uv run python main.py`
2. `POST /api/v1/workspaces` with `{"name": "Canal Curiosidades", "language": "es", "target_format": "shorts"}`.
3. `GET /api/v1/workspaces` — confirm it appears.
4. In the React app (`npm run dev`), open "Canales" in the nav, confirm the
   workspace is listed, edit it, confirm the change persists.
5. Start a new project, pick the workspace from the selector, confirm the
   script language field prefills, submit, then `GET /api/v1/projects/{id}`
   and confirm `workspace_id` matches.
6. Set `TURBOPRINTER_WORKSPACES_ENABLED=false`, restart, confirm
   `/api/v1/workspaces` 404s and creating a project without a workspace
   still works exactly as before.
