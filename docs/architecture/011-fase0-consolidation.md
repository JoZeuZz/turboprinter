# 011 — Fase 0 consolidation (Content Automation Lab)

## Summary

`docs/design/context.md` introduces a new strategic roadmap ("Content Automation
Lab"): TurboPrinter evolves from a video pipeline into a platform that also
publishes, measures, and learns from content performance (Workspaces, prompt
versioning, operational DB, scheduler, publication, metrics, experiments,
decision engine). This doc closes that roadmap's **Fase 0 — Consolidación del
estado actual**: verify the current state is stable before building the new
business layer on top of it.

## Decisions

- **Roadmap authority**: `docs/design/context.md` is now the authoritative
  product vision. `docs/architecture/010-product-vision.md` is marked
  superseded (see its header) but kept as historical reference for the
  UI/render tactical phases it describes — several of which already shipped
  (multi-track timeline editor, drag&drop, sequential preview). Its "Fase N"
  numbering must not be conflated with `context.md`'s "Fase 0-10" numbering.
- **Branch strategy**: new business-layer work happens on `personal/content-lab`,
  branched from `main`. Per CLAUDE.md, personal work should live on `personal/*`
  branches with `main` tracking upstream — in practice `personal/quality-stack`
  and `personal/project-mode` had already been fully merged into `main` (0
  commits of difference), so `main` currently *is* the de facto personal branch.
  This is pre-existing drift from the stated strategy, not something this fase
  changes; `personal/content-lab` at least isolates the new business-layer work
  going forward.
- **Fase 0 scope**: formal re-verification (not a rebuild) of validation
  commands + test suite + CLI, since the prior project-mode roadmap (Fases 0-9,
  domain/planning/media/rendering/music/reddit) was already implemented and
  merged before this fase started.

## Verification performed

- `uv lock --check` — lockfile in sync with `pyproject.toml`.
- `uv run python -m compileall app webui` — no errors.
- `uv run pytest` — 673 passed / 1 failed / 5 skipped initially.
- `uv run python cli.py --help` — CLI functional.

## Finding: stale test, not a regression

`test/controllers/test_projects_list.py::test_list_projects_project_mode_disabled`
asserted `GET /api/v1/projects` returns `404` when `project_mode_enabled=False`.
The actual (intended) behavior of `list_projects` is a legacy-compatible
fallback: when project mode is off, it returns `200` with the legacy generated
video task listing instead of `404` — this is the correct upstream-compat
behavior other `_require_project_mode`-gated endpoints don't need, since this
one predates project mode. The test was outdated, not the code. Updated the
assertion to expect `200` + `"projects"` in the response body.

Result after fix: **674 passed, 5 skipped, 0 failed.**

## No secrets found

No `config.toml`, credentials, or API keys were read, logged, or touched during
this verification.

## Next

Fase 0 closed. Next up (per `docs/design/context.md`): Fase 1 (preflight
validator + manual editor hardening) or Fase 2 (`Workspace` model) — pending
user direction.
