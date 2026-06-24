# 010 — TurboPrinter Product Vision

**Persisted**: 2026-06-24
**Purpose**: Anchor document for future agent iterations. Defines what this fork is trying to be, the two-flow architecture, and the agentic AI goal.

---

## What TurboPrinter Is

A **content automation tool** for generating short-form social media videos. Not a video editor. Not a media manager. The primary goal is producing quality videos with minimal friction — ideally with zero human intervention when running in fully automatic mode.

The target user is a solo content creator (or an AI agent acting on their behalf) who wants to go from *topic idea* → *publishable video* as fast as possible.

---

## The Two Flows

### Flow 1 — Automatic (Auto)

AI controls the full pipeline. The human provides a topic (or the AI generates that too). Everything else — script, keywords, clip selection, timing, TTS, subtitles, render — is handled autonomously.

**Agentic goal**: An AI agent should be able to call the TurboPrinter API, pass a topic, and receive a finished video. No UI required. The pipeline endpoint sequence is:

```
POST /api/v1/projects          (create)
POST /api/v1/projects/:id/plan (plan shots)
POST /api/v1/projects/:id/media-search (fetch clips)
POST /api/v1/projects/:id/timeline/build (assemble)
POST /api/v1/projects/:id/render (render)
GET  /api/v1/projects/:id/render/status (poll)
```

This must always work without any UI interaction.

### Flow 2 — Semi-manual (Editor)

Same pipeline as Auto, but pauses at the `generated` state. The user can:
- Preview downloaded clips
- Exclude clips they don't like
- Reorder clips in the timeline
- Trim clip start/end points
- Adjust timing

Then trigger the final render. The Editor is not a general-purpose video editor — it is a lightweight review-and-adjust tool designed for the specific output of the Auto pipeline.

**Key constraint**: The Editor must remain simple. Its job is *affining* a nearly-finished video, not building one from scratch.

---

## Architecture Principles

### Project as the central entity

Every video is a project with explicit state (`draft → scripting → scripted → generating → generated → editing → rendering → done`). The UI reflects project state; it does not own it. The backend is the source of truth.

### AI-first API design

Every UI action must have an API equivalent. If a human can do it in the UI, an AI agent must be able to do it via API. This means:
- No UI-only state (everything syncs to backend)
- Explicit state machine (no implicit transitions)
- Idempotent endpoints where possible

### Opt-in quality stack

Personal improvements live in `app/services/quality/` and are opt-in via `[quality]` config. The base pipeline must remain equivalent to upstream MoneyPrinterTurbo when quality stack is disabled.

### Upstream compatibility

`main` stays close to upstream. Personal features live in `personal/*` branches. The fork does not fork the spirit of the project — it extends it.

---

## Planned Features (Roadmap)

These are goals. Implementation is phased. Order reflects priority.

### Phase 2 — AI Orchestration (in progress / planned)

**Problem**: Current AI only writes script + keywords. Clips are searched generically. Result: thematic but visually disconnected from narration.

**Goal**: AI generates per-segment `ClipPlan` with specific search queries, mood, and shot type. Multi-provider parallel search replaces single-provider sequential.

Key additions:
- `ClipPlan` schema: `{ segment_text, start_sec, duration_sec, search_query, mood, shot_type }`
- `POST /api/v1/llm/orchestrate-clips` endpoint
- `POST /api/v1/media/search-multi` endpoint (async search across all providers with keys)
- AutoFlow UI toggle: "AI Orchestration (experimental)"

LLM providers supported: DeepSeek, OpenAI, Gemini, Groq (all via configurable API key + base URL).

### Phase 3 — Editor Timeline (planned)

Full implementation of the Editor panel in the workspace redesign:
- `dnd-kit` for drag-drop clip reorder
- `wavesurfer.js` for audio waveform visualization
- Trim handles on clip pills
- "Replace clip" search modal
- Inspector panel for selected clip

### Phase 4 — OpenCut Backend (planned)

Study OpenCut's FFmpeg pipeline (`github.com/OpenCut-app/OpenCut`) for higher-quality effects and transitions. Re-implement patterns in Python — do NOT import TypeScript/Next.js code.

New service: `app/services/assembly/opencut_renderer.py`
Toggle: `[quality] renderer = "opencut"`

### Phase 5 — Expansions (planned, independent of 3-4)

**Reddit Ingestion**
- PRAW-based scraper: top posts, thread by URL, AITA/confessions subreddits
- Thread → narration script formatter with dramatic pauses
- AutoFlow: "From Reddit" content type option

**Contextual BGM**
- Current music is generic. Replace with dynamic API search.
- Providers: Freesound API, Jamendo API (both free/CC licensed)
- LLM infers mood from script → searches BGM by mood + keywords
- Config: `[bgm] provider = "jamendo"` (Jamendo provider started in advisor-plans/008)

---

## What TurboPrinter Is NOT

- A general-purpose video editor (use DaVinci, Premiere for that)
- A platform for multiple users (single-user LXC/Proxmox deploy)
- Dependent on OpenAI or Anthropic APIs (Ollama + open providers are first-class)
- A mobile app
- A replacement for creative direction (AI assists, human approves)

---

## Tech Stack Summary

| Layer | Tech |
|-------|------|
| Backend API | FastAPI + Python 3.11-3.12 |
| Video render | MoviePy + FFmpeg |
| LLM | Configurable: DeepSeek, Gemini, OpenAI-compat, Ollama |
| TTS | edge-tts (default), Azure TTS |
| Media providers | Pexels, Pixabay, Coverr, local library |
| BGM | Local files (current), Jamendo/Freesound (planned) |
| Frontend | React 18 + TypeScript + Vite + Tailwind + Zustand |
| Deploy | LXC container on Proxmox, reverse proxy, no GPU required |

---

## Related Documents

- `docs/specs/2026-06-23-webui-redesign-design.md` — Phase 1 spec (backend API contracts)
- `docs/superpowers/specs/2026-06-24-webui-react-workspace-redesign.md` — This UI redesign spec
- `docs/architecture/001-project-timeline-architecture.md` — Timeline/project API
- `docs/architecture/002-ai-shot-planner.md` — ClipPlan schema design
- `docs/architecture/003-media-aggregator.md` — Multi-provider search
- `docs/architecture/004-manual-editor-roadmap.md` — Editor roadmap
- `docs/architecture/007-contextual-music.md` — BGM contextual search
- `docs/architecture/008-reddit-ingest.md` — Reddit ingestion
