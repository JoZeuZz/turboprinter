# 000 — Current State Audit

## Repo structure
- `app/` — FastAPI backend (`main.py`, `app/asgi.py`, `app/router.py`)
- `app/controllers/v1/` — video.py, llm.py route handlers
- `app/services/` — task.py (orchestrator), video.py (render), material.py
  (media providers), voice.py (TTS), llm.py (LLM providers), subtitle.py
- `app/services/quality/` — opt-in Personal Quality Stack
- `app/models/schema.py` — VideoParams + API models
- `app/config/config.py` — config.toml loader
- `webui/Main.py` — Streamlit UI
- `cli.py` — headless CLI

## Current pipeline (app/services/task.py)
script generation → terms/keywords → audio (TTS) → word timestamps →
subtitles → material download → final render → manifest.
Artifacts written under `storage/tasks/{task_id}/` and `_meta/`.

## Critical files
- `app/services/task.py` — pipeline orchestrator (do not modify in Plan 1)
- `app/services/video.py` — MoviePy/FFmpeg render
- `app/services/material.py` — pexels/pixabay/coverr search + download
- `app/models/schema.py:59` — `VideoParams`

## Coupling points
- WebUI and CLI both call into task.py directly.
- material.py dispatches by `video_source` string (single provider).
- llm.py providers: openai, deepseek, gemini (litellm 1.86.2 also installed).

## Media providers
pexels, pixabay, coverr (material.py); local library (quality stack).

## Endpoints
POST /api/v1/videos, /subtitle, /audio; GET/DELETE /tasks; GET/POST /musics,
/video_materials; GET /stream, /download; POST /scripts, /terms, /social-metadata.

## Risks of modifying the pipeline
- task.py is the single orchestrator; changes ripple to WebUI/CLI/API.
- video.py render is MoviePy-coupled.
- schema.py mixes API params with implicit domain.

## Where new contracts integrate
- New `app/domain/` is additive, consumed later by services/controllers.
- New `app/infrastructure/storage/` persists alongside `_meta/` in task dirs.
- Plan 1 introduces no runtime wiring; later plans add endpoints/services.
