# 015 — Prompt Templates & Versioning (Content Automation Lab, Fase 3)

## Summary

Adds `PromptTemplate` and `PromptVersion`, the second and third persistent
business entities of the Content Automation Lab roadmap
(`docs/design/context.md`), following `Workspace` (Fase 2). A `PromptTemplate`
is a named narrative formula (e.g. "Curiosidades ES", "Misterio ES") with a
`system_prompt`/`user_prompt_template` pair; each edit to that pair is a new,
numbered, immutable `PromptVersion` under the template, with exactly one
version marked `active` at a time. Projects can optionally reference a
`prompt_template_id`/`prompt_version_id` at creation time; when a script is
actually generated server-side (`POST /projects/from-topic` with
`generate_script=true`), the active (or explicitly chosen) version's prompts
are rendered and used. Every project records which template/version/provider/
model produced its script, so future work can compare rendering quality by
formula.

## What problem this solves

Before this fase, `llm.generate_script()` only had two script-shaping knobs:
a free-text `custom_system_prompt` and `video_script_prompt` override, typed
by hand into the WebUI's "Advanced Prompt" collapsible on every single
generation. There was no way to save a formula, version it, know which
formula (and which edit of that formula) produced a given script, or compare
"Reddit Story" against "Top List" performance later. A `PromptTemplate` is a
reusable, versioned formula a project can optionally point at — the same
relationship `Workspace` has to a project, but for the narrative recipe
instead of the channel identity.

## Persistence

`PromptTemplateStore` (`app/infrastructure/storage/prompt_template_store.py`)
writes one JSON file per template at `storage/prompt_templates/<id>.json`,
and one JSON file per version at
`storage/prompt_templates/<id>/versions/<version_id>.json`. This mirrors
`WorkspaceStore`'s flat-file pattern (Fase 2) with one addition: a
`versions/` subdirectory per template, since a template's version history is
the one piece of this fase's data model with real internal structure. Both
`list_templates()` and `list_versions()` isolate per-entry read/parse
failures (skip + log a warning, keep the rest of the listing) rather than
letting one corrupted file take down the whole call — this was a real gap
Fase 2's `WorkspaceStore.list()` shipped without and had to patch in a
follow-up commit; it's built in here from the start. Migrating to a real
database in Fase 4 should mean swapping the store implementation behind the
same method set (`save_template`/`load_template`/`list_templates`/
`delete_template`/`exists`, `save_version`/`load_version`/`list_versions`),
not touching callers.

## Endpoints

All under `/api/v1/prompt-templates`, gated by
`TURBOPRINTER_PROMPT_TEMPLATES_ENABLED` (default off; 404 when off,
independent of `TURBOPRINTER_PROJECT_MODE_ENABLED` and
`TURBOPRINTER_WORKSPACES_ENABLED`):

| Method | Path | Behavior |
|---|---|---|
| GET | `/prompt-templates` | List all, sorted by `updated_at` descending |
| POST | `/prompt-templates` | Create; also creates and activates version 1; `400` if `name` blank |
| GET | `/prompt-templates/{id}` | Get one; `404` if missing |
| PUT | `/prompt-templates/{id}` | Update `name`/`content_type`/`language`/`metadata` only — **not** prompt content, that's version-managed; `404` if missing, `400` if `name` blank |
| POST | `/prompt-templates/{id}/versions` | Create a new, inactive version; version number auto-increments; `404` if template missing |
| GET | `/prompt-templates/{id}/versions` | List versions, sorted by version number ascending |
| POST | `/prompt-templates/{id}/activate-version` | Body `{"version_id": "..."}`; marks that version active, deactivates the previous active one, refreshes the template's cached `system_prompt`/`user_prompt_template`/`expected_schema` from it; `404` if template or version missing |

`template_id`/`version_id` path parameters are validated the same way
`projects.py` validates `project_id` (`_validate_project_id`'s pattern,
mirrored as `_validate_template_id`) — rejects `..`, empty segments, and a
leading `/` before the id ever reaches a filesystem path. Fase 2 shipped
`workspaces.py` without this guard and needed a follow-up security-fix
commit; it's built in here from the start.

No FK integrity is enforced between a project's `prompt_template_id` and
`PromptTemplateStore` at creation time beyond a load-and-check (see
"Relation to project mode" below) — same intentional simplification
`Workspace` uses for `workspace_id`.

## The renderer

`app/domain/prompts/renderer.py` implements `{{variable}}` substitution with
a small closed set of supported variables: `topic`, `language`, `duration`,
`platform`, `workspace`, `style`. It is deliberately **not** Jinja2 or any
templating library — no new dependency, no code execution, just a regex
substitution over a fixed pattern. Malformed syntax (an unclosed `{{`)
can never raise: it simply fails to match the placeholder pattern and passes
through as literal text. A recognized placeholder with no non-empty value in
the variables dict raises `PromptRenderError` naming every missing variable
at once — this is the "Validar variables faltantes" requirement from the
fase's spec, surfaced as a controlled `400` at the API boundary
(`app/controllers/v1/projects.py`'s `_render_prompt_template` helper), never
an unhandled exception.

## Relation to project mode

`prompt_template_id`/`prompt_version_id` are new optional fields on
`CreateFromTopicRequest` and `CreateFromScriptRequest`
(`app/models/project_schema.py`). Behavior differs by endpoint because only
one of them ever calls the LLM:

- **`POST /projects/from-topic`** (with `generate_script=true`): if
  `prompt_template_id` is given, the active (or explicitly chosen) version's
  `system_prompt`/`user_prompt_template` are rendered against `topic`,
  `language`, `duration` (from `target_duration_sec`), `style` (from
  `global_visual_style`), and `platform`/`workspace` (resolved from
  `workspace_id` via `WorkspaceStore`, when given). The rendered strings are
  passed into the *existing*, unmodified `llm.generate_script(...)` call as
  `custom_system_prompt`/`video_script_prompt` — the same two override
  parameters the WebUI's "Advanced Prompt" collapsible already writes to
  today. `app/services/llm.py` was not touched by this fase. An unknown
  template/version, a disabled flag, or a render failure (missing variable)
  all return `400` — a template that was explicitly requested and can't be
  honored fails loudly rather than silently falling back.
- **`POST /projects/from-script`**: the ids are stored as trace metadata
  only — no rendering, no validation, since the script was already written
  (possibly generated elsewhere using that exact template/version).
- **Without a `prompt_template_id`**: both endpoints behave exactly as
  before this fase.

Every project's metadata (`FilesystemProjectStore.save_project_metadata`,
persisted in `project.json`) gains `prompt_template_id`, `prompt_version_id`,
`provider` (the configured `llm_provider`, only set when a template actually
drove generation), `model` (the version's `model_hint`, if any), and
`rendered_prompt` (`{"system_prompt": ..., "user_prompt": ...}`, the actual
text sent to the LLM — set only when a template was used). `GET
/projects/{id}` surfaces `prompt_template_id`/`prompt_version_id`/
`provider`/`model` back to callers.

**No secrets ever land in `rendered_prompt`.** It's built purely from the
template's own prompt text plus the six supported variables (topic,
language, duration, platform, workspace, style) — none of which can carry a
credential in normal use. Do not put API keys, tokens, or other secrets
inside a `system_prompt`/`user_prompt_template` field; there is no mechanism
in this fase that would redact them before they're persisted to
`project.json`.

## Seed templates

`app/domain/prompts/seeds.py` ships five default Spanish templates (`Reddit
Story ES`, `Curiosidades ES`, `Misterio ES`, `Historia ES`, `Top List ES`),
each with one active version. `seed_default_templates(store)` is idempotent
— it skips any name that already exists — and is invoked manually via `uv
run python scripts/seed_prompt_templates.py`. It is **not** run
automatically at app startup, to keep `storage/` writes predictable and
opt-in; run the script once after enabling
`TURBOPRINTER_PROMPT_TEMPLATES_ENABLED`.

## Frontend

- `webui-react/src/api/promptTemplates.ts` — `promptTemplatesApi` client
  (list/create/get/update/addVersion/listVersions/activateVersion).
- `webui-react/src/api/types.ts` — `PromptTemplate`, `PromptVersion`,
  `PromptTemplateCreateRequest`, `PromptTemplateUpdateRequest`,
  `PromptVersionCreateRequest` types; `prompt_template_id`/
  `prompt_version_id` added to `CreateFromTopicRequest`/
  `CreateFromScriptRequest`; `prompt_template_id`/`prompt_version_id`/
  `provider`/`model` added to `GetProjectResponse`.
- `webui-react/src/store/usePromptTemplatesStore.ts` —
  list/create/update/addVersion/listVersions/activateVersion.
- `webui-react/src/components/panels/ScriptPanel.tsx` — gains an optional
  prompt-template `<Select>` (and a version `<Select>` once a template is
  picked); selecting a template+version threads `prompt_template_id`/
  `prompt_version_id` into `createFromScript` for traceability. **Note:**
  `ScriptPanel`'s "Generate" button calls `llmApi.generateScript(...)`
  (`/api/v1/llm/generate-script`), a separate, client-orchestrated endpoint
  this fase does not touch — not `POST /projects/from-topic`. So today, the
  selector's effect in the WebUI is real project-level traceability (the
  ids are correctly recorded on the created project and returned by `GET
  /projects/{id}`), but the template does **not** yet drive the live
  "Generate" button's actual LLM call in the browser. Full generation-time
  integration with that button — likely by teaching `/api/v1/llm/generate-script`
  the same `prompt_template_id`/`prompt_version_id` resolution
  `create_from_topic` now has — is left for a follow-up, the same way Fase
  2's `ScriptPanel` selector deferred voice/subtitle/visual-style
  propagation. Template-driven server-side generation is fully wired and
  usable today via `POST /projects/from-topic` directly (API/CLI).
- `webui-react/src/store/useProjectStore.ts` — gains a `projectMeta` state
  field (`{topic, workspace_id, prompt_template_id, prompt_version_id,
  provider, model} | null`), populated whenever a project is opened/refreshed.
- `webui-react/src/components/panels/EditorPanel.tsx` — when
  `projectMeta.prompt_template_id` is set, fetches and shows the template's
  name and the active version's number in a small info line.

## Testing

Backend: `test/domain/test_prompt_template.py`,
`test/domain/test_prompt_renderer.py`,
`test/infrastructure/test_prompt_template_store.py`,
`test/services/test_prompt_template_service.py`,
`test/controllers/test_prompt_templates_endpoints.py` (full CRUD +
versioning + activate + disabled-flag 404 + traversal-id rejection),
`test/domain/test_prompt_template_seeds.py`, plus integration tests in
`test/services/test_project_endpoints.py` (template-driven generation,
unknown-template/disabled-flag 400s, no-template fallback, from-script
trace-only storage). Frontend:
`usePromptTemplatesStore.test.ts`, and `ScriptPanel.test.tsx` /
`useProjectStore.test.ts` cases for the selector and the detail display.

## Manual verification

1. `TURBOPRINTER_PROJECT_MODE_ENABLED=true TURBOPRINTER_PROMPT_TEMPLATES_ENABLED=true uv run python main.py`
2. `uv run python scripts/seed_prompt_templates.py` — creates the 5 default templates.
3. `GET /api/v1/prompt-templates` — confirm the 5 appear, each with one active version.
4. `POST /api/v1/prompt-templates/{id}/versions` with a tweaked `user_prompt_template`, then `POST /api/v1/prompt-templates/{id}/activate-version` with that new version's id — confirm `GET /api/v1/prompt-templates/{id}` now shows the new `user_prompt_template` as the template's own cached content.
5. `POST /api/v1/projects/from-topic` with `{"topic": "gatos", "language": "es", "generate_script": true, "prompt_template_id": "<id>"}` — confirm `200`, then `GET /api/v1/projects/{id}` and confirm `prompt_template_id`/`prompt_version_id`/`model` are populated.
6. In the React app (`npm run dev`), open the script creation panel, pick a template and version, confirm the created project's detail view (`EditorPanel`) shows the template name and version number.
7. Set `TURBOPRINTER_PROMPT_TEMPLATES_ENABLED=false`, restart, confirm `/api/v1/prompt-templates` 404s and creating a project without a `prompt_template_id` still works exactly as before.
