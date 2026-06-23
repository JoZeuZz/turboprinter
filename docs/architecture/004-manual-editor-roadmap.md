# 004 — Manual editor roadmap

> Fase 7 of the project-mode evolution (see `plans/spec/spec-001.md`). Standalone,
> opt-in, additive. The legacy WebUI (`webui/Main.py`) is untouched.

## MVP scope (implemented)

A minimal manual editor lets the user review/edit a project before render:

- create a project from a pasted script,
- load an existing project by id,
- run plan / search media / build timeline,
- review the script and ShotPlan segments,
- inspect video timeline clips with segment, provider, path/source, start,
  duration, trims, query and score metadata when available,
- queue and save reorder, trim, duration and replace commands,
- validate the timeline before render,
- launch a background render with MoviePy or request OpenCut and receive a clear
  not-implemented failure,
- poll render status,
- select contextual music and volume.

## Architecture

Two pieces, deliberately separated:

- `webui/project_api.py` — a pure, testable HTTP client (`ProjectApiClient`)
  that builds URLs, calls the Fase 6 API and parses responses. No Streamlit.
  Unit-tested with `requests` monkeypatched.
- `webui/pages/2_Project_Editor.py` — a Streamlit multipage script that only
  orchestrates widgets and delegates to the client. Pure helpers
  (`build_trim_command`, `build_reorder_commands`, `build_set_timing_command`,
  `build_replace_command`, `asset_id_for_local_path`) live at module top-level
  and are unit-tested without running Streamlit.

The page consumes **only** the Fase 6 REST API; it never imports `task.py`,
`video.py` or `material.py`. `webui/Main.py` is not modified, so the legacy
WebUI is unaffected.

## Why a separate page

`webui/Main.py` is a large monolith. A new multipage script keeps the editor
isolated, lowers risk and follows the fork rule of small, localized changes.

## Out of scope (future)

- A graphical timeline (CapCut/OpenCut-style) — not copied.
- Frame-level editing, advanced transitions, complex multi-track UI.
- Drag-and-drop timeline reordering. Current MVP uses buttons and forms.
- Frame-level preview/scrubbing. Current preview uses safe project-local asset URLs
  with `st.video()` when available and shows links/placeholders otherwise.

## Path to a richer editor

If a graphical editor is needed later, the timeline-as-source-of-truth + edit
commands + REST API already provide the contract. A future React/JS app (or a
richer Streamlit page) could consume the same endpoints without changing the
backend. See `docs/architecture/005-opencut-integration-notes.md` for the
OpenCut concepts adopted.

## Activation

Requires `TURBOPRINTER_PROJECT_MODE_ENABLED=true` and the API running
(`python main.py`). With project mode off, the page shows API errors and the
rest of the WebUI is unaffected.
