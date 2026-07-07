# 012 — Current Project Mode Audit (Fase 0, `docs/design/context.md`)

**Date**: 2026-07-07
**Scope**: Full-repo audit — legacy pipeline, Personal Quality Stack, Project
Mode (backend + frontend), before building the Content Automation Lab business
layer (Workspaces, DB, scheduler, publication, metrics, experiments).

> Note on numbering: `010` is already taken by `docs/architecture/010-product-vision.md`
> (now marked superseded) and `011` by `docs/architecture/011-fase0-consolidation.md`
> (this fase's closure doc, written before this audit). This file uses `012` to
> avoid a filename collision with the number the prompt specified.

---

## 1. Legacy pipeline — status: **implemented, stable**

The upstream MoneyPrinterTurbo pipeline (`app/services/task.py` orchestrator,
`app/services/video.py`, `material.py`, `voice.py`, `llm.py`) is untouched and
fully functional. It is the default path whenever `project_mode_enabled` and
the Quality Stack are off. Entry points: `main.py` (API/uvicorn), `cli.py`
(headless), `webui/Main.py` (Streamlit).

Confirmed via: full pytest run (below) exercises `test_task.py`, `test_video.py`,
`test_voice.py`, `test_material*.py`, `test_llm.py`, `test_cli.py`,
`test_schema.py`, `test_upload.py`, `test_stream_range.py` — all green except a
pre-existing, environment-specific `test_llm.py` note (see §12).

## 2. Personal Quality Stack — status: **implemented, opt-in, stable**

`app/services/quality/` — render profiles (fast/balanced/high/archival),
premium subtitles + ES normalization + safe-area, deterministic material
ranker, local library (SQLite via `library_cli`), unified TTS adapter +
optional Whisper alignment, Spanish content package (no LLM required), render
manifest. All gated by `[quality] enabled` in `config.toml`; `enabled=false`
reproduces upstream behavior exactly (README §1, verified by
`test_quality_*` suite — 13 test files, all passing).

`app/services/quality/llm_providers/` (registry: `OpenAICompatProvider`,
`GeminiProvider`, `get_provider()`) exists but is **partially wired**:
`_generate_response_single` in `llm.py` still keeps known providers
(openai/groq/deepseek/etc.) inline to preserve `test_llm.py`'s patches on
`llm.OpenAI`; the registry only routes unknown/custom provider names. This is
documented as a known pending migration in README §3b, not a bug.

## 3. Project Mode — status: **implemented, opt-in, functional end-to-end**

Domain (`app/domain/{planning,media,music,projects,rendering,sources}/`),
application services, infrastructure, and REST API are all present and
exercised by tests. Gated by `TURBOPRINTER_PROJECT_MODE_ENABLED` (default
off) — when off, `/api/v1/projects/*` endpoints 404 (except `GET /projects`,
see §11 finding) and the legacy pipeline is untouched.

### End-to-end flow (confirmed wired, not just documented)

```
POST /projects/from-topic|from-script|from-reddit  → project created, script saved
POST /projects/{id}/plan                            → ShotPlanner → shot_plan.json
POST /projects/{id}/media/search                    → MediaAggregator → media_candidates.json + selected_media.json
POST /projects/{id}/narration                        → TTS → narration audio
POST /projects/{id}/timeline/build                    → TimelineBuilder → timeline_project.json
POST /projects/{id}/timeline/commands                 → apply_all() edit commands, validated
POST /projects/{id}/timeline/validate                  → validate_timeline_project()
POST /projects/{id}/music/select                        → MusicSelector → selected_music.json
POST /projects/{id}/render (background)                  → render_project_from_store → MoviePyTimelineRenderer → final.mp4
GET  /projects/{id}/render                                → poll status
```

React frontend (`webui-react/src/store/useProjectStore.ts`) drives this same
sequence: `create → plan → mediaSearch → synthesizeNarration → buildTimeline →
applyTimelineCommands (validated) → render → pollRenderStatus`. Streamlit
alternative: `webui/pages/2_Project_Editor.py` via `webui/project_api.py`.

### Endpoints (`app/controllers/v1/projects.py`, 20 routes)

| Method | Path | Gated by `_require_project_mode`? |
|---|---|---|
| GET | `/projects` | **No** — legacy fallback when off (see §11) |
| POST | `/projects/from-topic` | Yes |
| POST | `/projects/from-script` | Yes |
| POST | `/projects/from-reddit` | Yes (+ `TURBOPRINTER_REDDIT_INGEST`) |
| GET | `/projects/{id}` | Yes |
| DELETE | `/projects/{id}` | Yes |
| PATCH | `/projects/{id}/metadata` | Yes |
| POST | `/projects/{id}/duplicate` | Yes |
| POST | `/projects/{id}/plan` | Yes |
| POST | `/projects/{id}/media/search` | Yes |
| POST | `/projects/{id}/narration` | Yes |
| POST | `/projects/{id}/timeline/build` | Yes |
| POST | `/projects/{id}/timeline/commands` | Yes |
| POST | `/projects/{id}/timeline/validate` | Yes |
| POST | `/projects/{id}/music/select` | Yes (+ `TURBOPRINTER_CONTEXTUAL_MUSIC`) |
| GET | `/projects/{id}/music` | Yes |
| PUT | `/projects/{id}` | Yes |
| POST | `/projects/{id}/render` | Yes |
| GET | `/projects/{id}/render` | Yes |
| GET | `/projects/{id}/assets` | Yes |
| GET | `/projects/{id}/assets/{asset_id}` | Yes |

Frontend client (`webui-react/src/api/projects.ts`, `projectsApi` object) has
21 methods — one-to-one with the backend endpoints (`getAsset` and
`listAssets` both map to asset routes).

### Feature flags (`app/config/config.py`, all `_env_bool_or_config`, default off)

| Flag | Default | Gates |
|---|---|---|
| `TURBOPRINTER_PROJECT_MODE_ENABLED` | off | Entire `/api/v1/projects` API + legacy fallback branch |
| `TURBOPRINTER_STRUCTURED_SHOT_PLANNER` | off | LLM-based ShotPlanner (else local heuristic) |
| `TURBOPRINTER_MULTI_PROVIDER_MEDIA` | off | MediaAggregator multi-provider concurrent search |
| `TURBOPRINTER_TIMELINE_RENDERER` | `moviepy` | `moviepy` \| `opencut` (stub) renderer selection |
| `TURBOPRINTER_CONTEXTUAL_MUSIC` | off | MusicSelector / `/music/select` |
| `TURBOPRINTER_REDDIT_INGEST` | off | Reddit ingest / `/from-reddit` |
| `TURBOPRINTER_VISION_RANKING_ENABLED` | off | `VisionRanker` (LiteLLM vision scoring for media) |
| `TURBOPRINTER_PHASE_TIMING` | off | Observability phase-timing instrumentation |

All confirmed tolerant to absence (default via `_env_bool_or_config` +
`.get(..., False)` on config dict — no `KeyError` risk).

---

## 4. Implemented vs. partial vs. stub vs. documented-only

### Fully implemented (has real logic + tests)
- Domain models: `ShotPlan`, `MediaCandidate`, `TimelineProject`, `RenderSpec`, `MusicTrack`, `StorySource` — all Pydantic v2, all tested (`test/domain/`).
- `FilesystemProjectStore` (JSON persistence under `storage/tasks/{id}/`).
- `ShotPlanner` (LLM path + deterministic local fallback).
- `MediaAggregator` + `MediaRanker` (deterministic scoring, multi-provider, dedup).
- `VisionRanker` / `LiteLLMVisionProvider` (real vision-scoring implementation, not a stub — gated by its own flag).
- `TimelineBuilder`, `TimelineProject.apply_all()` + 5 edit commands + validators (bounds/no-gaps/no-overlaps).
- `MoviePyTimelineRenderer` (`_concat_timeline_clips`, trims honored, reuses legacy `generate_video` for subtitles/BGM/mux).
- `MusicSelector` + `LocalMusicProvider`.
- Reddit ingest (`reddit_ingest.py`, PRAW lazily imported — works without it via manual payload).
- Full REST API (20 endpoints) + React client + Zustand store + Streamlit editor page.

### Partial
- LLM provider registry (`llm_providers/`) — built but only routes unknown providers; known providers stay inline in `llm.py` (documented migration debt, README §3b).
- Timeline validation — covers bounds/gaps/overlaps only. No asset-existence check, no duration/audio/subtitle/license/placeholder checks (this is exactly context.md's Fase 1 gap — confirmed, `grep -rn "preflight_check"` returns nothing anywhere in the repo).

### Stub (interface exists, logic doesn't)
- `OpenCutAdapter` (`app/infrastructure/renderers/opencut_adapter.py:20`) — raises `NotImplementedError` by design (spec-001 decision, not a bug). `render_project.py:98` catches it and turns it into a failed `RenderResult` with a clear warning, so requesting it doesn't silently fall back to MoviePy.
- `JamendoProvider.search()` (`jamendo_provider.py:23`) — returns `[]` unconditionally ("stub: no network until implemented"). Local music provider is the only working music source.

### Documented but not implemented at all (business layer — this is the actual Fase 0 gap this whole roadmap exists to close)
- `Workspace`, `PromptTemplate`/`PromptVersion`, `ProjectRun`, `VideoOutput`, `Publication`, `MetricsSnapshot`, `Experiment`/`ExperimentVariant`, `DecisionRule`/`DecisionEvent` — **zero code**. No SQLAlchemy/SQLite/Alembic/APScheduler/Celery/RQ in `pyproject.toml`. Confirmed by repo-wide grep — this layer is greenfield, exactly as `docs/design/context.md` §19 states.
- `preflight_check` — zero code, mentioned only in `docs/design/context.md` and the old project-mode-roadmap memory as a Fase 1 goal.

---

## 5. Technical risks

1. **`llm.py` provider migration left half-done — and the README's own completion instructions were unsafe.** Re-read the full `_generate_response_single` body this pass: the `_inline` set mixes 14 genuinely OpenAI-wire-compatible providers (safe to route through the registry) with 6 providers using real custom protocols — `qwen`/`cloudflare`/`ernie` have a literal `base_url = "***"` placeholder (not OpenAI-shaped), `pollinations` hand-rolls its own `requests.post` payload, `litellm`/`g4f` delegate to their own libraries. `get_provider()` falls back to `OpenAICompatProvider` for any name it doesn't recognize — so blindly "removing the `_inline` set" as README previously instructed would silently break those 6 providers' actual protocol, not just require a test-patch update. Corrected README §3b with the precise safe/unsafe split. Did not perform the migration itself this pass — it's a real ~14-test-patch-target TDD task, not a low-risk drive-by fix, and belongs in a dedicated session before Fase 3 (prompt versioning) touches this file again.
2. **No `preflight_check`.** A render can currently be triggered on a timeline with valid bounds/gaps/overlaps but missing/placeholder assets, no narration, or no subtitles — nothing stops it before render time except whatever the renderer itself tolerates (black-frame fallback for missing files, per `010-product-vision.md`). This matches context.md's Fase 1 priority.
3. **Two conflicting numbered roadmaps existed** in `docs/architecture/` (010 old vision vs. context.md new vision) — resolved this fase (010 marked superseded), but any other doc/agent memory referencing "Fase 2" etc. needs to be read with the source doc identified, not the number alone.
4. **OpenCut stays a stub** — acceptable per spec-001, but any code that assumes `TURBOPRINTER_TIMELINE_RENDERER=opencut` "just works" will fail loudly (by design) rather than degrade gracefully. Worth a guard in any future UI that exposes the renderer choice, so users don't pick it expecting output.
5. **Jamendo provider is inert** — contextual music today is local-library-only in practice; anyone enabling `TURBOPRINTER_CONTEXTUAL_MUSIC` without a populated local library gets no music, silently (returns `[]`, not an error).

## 6. Security risks

All of the following are already documented in `README_PERSONAL_FORK.md` §7 and were spot-checked against code, not just trusted:

1. **CORS defaults to wildcard without credentials** (`app/asgi.py:66-86`, `_resolve_cors_config`) — verified: empty `CORS_ALLOWED_ORIGINS` env var yields `allow_origins=["*"]` with `allow_credentials=False` (the function's own docstring explains this is deliberate, to avoid the wildcard+credentials combination browsers reject and that would be a real vulnerability). Confirmed this invariant is enforced in code, not just asserted in docs.
2. **`tls_verify` defaults to `True`** (`app/services/material.py:25`) — confirmed. Disabling it logs a warning (line 31). Good.
3. **`storage/tasks/<id>/_meta/` was fetchable via the static mount — fixed this pass.** `app/asgi.py` mounted the whole `task_dir` at `/tasks` via plain `StaticFiles`; `_meta/` (scripts, manifests, word timestamps) was only excluded from listings, not from direct fetch — `GET /tasks/<id>/_meta/script.json` returned `200` to anyone who could reach the mount and knew/guessed the path. Added `_PrivateMetaStaticFiles` (subclasses `StaticFiles`, overrides `get_response` to 404 any path with a `_meta` segment) — now enforced at the mount, not just hidden from a listing. Public assets (video/audio/subtitles) are unaffected. Test: `test/services/test_task_static_mount.py`. README §7 updated. This does not replace the reverse-proxy + auth boundary for public exposure — it closes one specific information-disclosure gap.
4. **`listen_host` defaults to `0.0.0.0`** in `config.example.toml` per README — LAN/public exposure by default unless the operator changes it. Documented, operator-dependent, not a code bug.
5. **No secrets were read, echoed, or committed during this audit.** `config.toml` was not opened. `.coverage` (untracked pytest coverage artifact) was not in `.gitignore` — fixed (see §9).

## 7. Tests by module (backend)

| Module | Test file(s) | Status |
|---|---|---|
| Legacy pipeline | `test_task.py`, `test_video.py`, `test_voice.py`, `test_material.py`, `test_material_key.py`, `test_cli.py`, `test_schema.py`, `test_upload.py`, `test_stream_range.py`, `test_state.py` | pass |
| LLM | `test_llm.py`, `test_structured_output.py` | pass (see §12 for a pre-existing env-specific caveat) |
| Quality Stack | 13× `test_quality_*.py` | pass |
| Domain | `test/domain/` (7 files: media candidate, music track, render manifest/spec, shot plan, story source, timeline project, timeline validators) | pass |
| Project Mode API | `test_project_endpoints.py`, `test_project_mode_flag.py`, `test/controllers/test_project_actions.py`, `test_projects_list.py`, `test/infrastructure/test_project_actions_store.py`, `test_project_store.py` | pass |
| Media/aggregation | `test_media_aggregator.py`, `test_media_providers.py`, `test_media_ranker.py`, `test_local_provider.py`, `test_vision_provider.py`, `test_vision_ranker.py` | pass |
| Music | `test_music_providers.py`, `test_music_selector.py` | pass |
| Reddit | `test_reddit_ingest.py` | pass |
| Timeline build/render | `test_timeline_builder.py`, `test_timeline_renderer.py`, `test_render_project.py`, `test_render_integration.py`, `test_preview_render_parity.py` | pass |
| WebUI (Streamlit) editor | `test/webui/test_project_api.py`, `test_project_editor_helpers.py`, `test_webui_i18n.py` | pass |
| Security/config | `test_cors_config.py`, `test_file_security.py` | pass |
| Observability | `test_observability.py` | pass |

**Full run**: `674 passed, 5 skipped, 0 failed` (after the §11 fix). 5 skips are environment-conditional (e.g. ffmpeg-dependent integration test), not failures.

### Tests by module (frontend)

`webui-react` — Vitest, 40 test files / 209 tests, covering panels, UI
primitives, stores (`useProjectStore`, `useProjectHistoryStore`,
`useProjectWorkspaceStore`, `useVideoStore`), i18n, API client, routing pages.
**Full run**: `40 files passed, 209 tests passed, 0 failed` — see §12, required
a clean `npm ci` first (see below).

## 8. Tests missing

- No test exercises `preflight_check` — it doesn't exist yet (Fase 1 work).
- **Correction (post-audit)**: this doc originally claimed `OpenCutAdapter` and `JamendoProvider` had no guard-rail tests. That was wrong for OpenCut — `test/services/test_timeline_renderer.py::test_opencut_adapter_raises_not_implemented` already asserts the `NotImplementedError` contract. For Jamendo, the existing `test_jamendo_stub_not_configured_without_key` only covered the no-key path, which left an actual gap: `search()` returns `[]` **even with a valid-looking key**, i.e. it's a true no-op stub, not just "inert when unconfigured" — nothing proved that distinction. Added `test_jamendo_stub_returns_no_results_even_when_configured` to `test/services/test_music_providers.py` to close it.
- No test asserts `OpenCutAdapter`'s failure is surfaced correctly through the full `/render` HTTP endpoint (only unit/workflow-level coverage) — worth one integration test when Fase 1 touches renderer selection, not urgent now.
- No business-layer tests exist because no business-layer code exists (expected — that's Fase 2+).
- Frontend: no test found for `useConfigStore.ts` or `useTaskStore.ts` (both exist under `store/` but weren't in the passing 40-file list scope reviewed) — worth confirming coverage before those stores grow with workspace state in Fase 2.

## 9. Stabilization recommendations (before Fase 2+)

1. Finish the `llm.py` → provider-registry migration for the **14 genuinely OpenAI-compatible provider names only** (see §5.1 for the exact safe/unsafe split) — patch their `test_llm.py` tests against `openai_compat.OpenAI`, then remove just those names from `_inline`. Keep `g4f`/`qwen`/`cloudflare`/`ernie`/`pollinations`/`litellm` inline. Scope as a dedicated TDD task before Fase 3 touches prompt/provider metadata — not a quick fix, ~14 test patch targets.
2. Build `preflight_check` (Fase 1, already on the roadmap) before any workspace/scheduler work starts generating projects unattended — right now nothing stops an automated render from shipping a video with missing assets.
3. Add the two guard-rail tests named in §8 for `OpenCutAdapter` and `JamendoProvider` so their stub status can't silently "become a bug" later.
4. ~~Decide `_meta` static-mount exposure before Fase 6~~ — done this pass (§5.3). Fase 6 (Publication) will still want its own access-control review once external IDs/OAuth tokens enter the picture, but the current information-disclosure gap is closed.
5. `.coverage` was untracked and **not** in `.gitignore` — fixed this pass (added to `.gitignore`) so it can't get committed by accident in a broad `git add`.

## 10. Frontend/backend contract check

`webui-react/src/api/projects.ts` (21 client methods) maps 1:1 to the 20
backend routes with no orphaned client calls or unreachable backend routes
found. `useProjectStore.ts`'s flow (`create → plan → mediaSearch →
synthesizeNarration → buildTimeline → applyTimelineCommands → render →
pollRenderStatus`) matches the backend sequence exactly — no drift detected.

## 11. Fix applied this pass (low-risk, tested)

`test/controllers/test_projects_list.py::test_list_projects_project_mode_disabled`
asserted `GET /api/v1/projects` returns `404` when project mode is disabled.
The actual, intended behavior (`app/controllers/v1/projects.py:390-397`) is a
legacy-compatible fallback returning `200` with the legacy generated-video
task listing — this endpoint predates project mode and intentionally isn't
gated by `_require_project_mode` like the other 19 routes, precisely so
`GET /projects` keeps working for legacy consumers when the flag is off. The
test was stale, not the code. Fixed the assertion; added a body-shape check.
See `011-fase0-consolidation.md` for the original write-up (this audit
supersedes that doc's verification section with the deeper pass above).

## 12. Environment notes

- `test_llm.py` baseline: per prior session memory, ~20 of its tests
  historically fail in this environment due to `litellm`'s handling of
  provider env vars; this pass's full run showed `test_llm.py` passing
  cleanly (0 failures attributable to it), so either the environment or the
  suite has since stabilized — not re-investigated further since it's outside
  this fase's scope and nothing regressed.
- Frontend tests initially failed **all 40 files** with
  `Failed to resolve import "i18next"` — `node_modules` was stale/incomplete
  relative to `package.json`/`package-lock.json` (`i18next` is declared but
  wasn't installed). Ran `npm ci` in `webui-react/` (246 packages installed,
  0 vulnerabilities, `node_modules` is gitignored so this touched no tracked
  files) — after that, all 40 files / 209 tests passed. This was a local dev
  environment gap, not a code or dependency-declaration bug.

---

## Summary for Fase 1 handoff

The system is exactly as advanced as `docs/design/context.md` describes: a
solid, tested, opt-in project-mode pipeline with zero business-layer code.
Nothing found here blocks starting Fase 1 (preflight validator) or Fase 2
(`Workspace` model). The one actionable gap directly in this fase's path is
**building `preflight_check`** — everything else is either already handled,
correctly stubbed by design, or a contained migration debt (`llm.py`) that
doesn't block new work.
