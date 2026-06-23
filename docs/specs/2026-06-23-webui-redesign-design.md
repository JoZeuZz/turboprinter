# TurboPrinter — WebUI Redesign & Architecture Plan

**Date**: 2026-06-23  
**Status**: Approved  
**Scope**: Full architectural roadmap (5 phases). Implementation target: Phase 1 only.

---

## 1. Context

MoneyPrinterTurbo is a short-video generation pipeline. The current WebUI is a 1804-line Streamlit monolith (`webui/Main.py`). It works but has hard limits: no real-time state, no drag-drop, no video preview, constrained layout. The upstream project owns `webui/Main.py` — custom UI work there creates perpetual merge conflicts.

This spec establishes a parallel personal frontend (`webui-react/`) that consumes the existing FastAPI backend (`/api/v1/`) and adds no upstream coupling. Streamlit stays intact and unchanged.

---

## 2. Architecture (Enfoque A — Monorepo integrado)

```
MoneyPrinterTurbo/
├── app/                        ← FastAPI backend (upstream + personal/)
│   ├── router.py               ← static mount for dist/ (conditional)
│   └── controllers/v1/         ← existing + new endpoints per phase
├── webui/Main.py               ← Streamlit — upstream, untouched
├── webui-react/                ← personal frontend — branch personal/webui-react
│   ├── src/
│   │   ├── pages/
│   │   │   ├── AutoFlow.tsx
│   │   │   ├── Editor.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   ├── api/
│   │   ├── store/
│   │   └── main.tsx
│   ├── dist/                   ← build output, gitignored
│   ├── package.json
│   └── vite.config.ts
└── scripts/
    └── build-ui.sh
```

### FastAPI static mount

```python
# app/router.py — appended, conditional on dist/ existence
from pathlib import Path
from fastapi.staticfiles import StaticFiles

_dist = Path(__file__).parent.parent / "webui-react" / "dist"
if _dist.exists():
    app.mount("/", StaticFiles(directory=_dist, html=True), name="react-ui")
```

Streamlit runs on port 8501 (unchanged). React served from FastAPI port 8080. No conflict.

### Branch strategy

| Branch | Content |
|--------|---------|
| `main` | Upstream-close, minimal personal patches |
| `personal/webui-react` | Phase 1 — React UI |
| `personal/ai-orchestration` | Phase 2 |
| `personal/editor` | Phase 3 |
| `personal/opencut-backend` | Phase 4 |
| `personal/expansions` | Phase 5 |

---

## 3. Phase Map

| Phase | Name | Deliverable |
|-------|------|-------------|
| **1** | React UI Foundation | AutoFlow functional + Editor skeleton |
| **2** | AI Orchestration | Clip-to-narration matching, multi-provider search |
| **3** | Manual Editor | Timeline drag-drop, preview, reorder, trim |
| **4** | OpenCut Backend | FFmpeg assembly improvements from OpenCut study |
| **5** | Expansions | Reddit ingestion, contextual BGM API |

Phase 5 is independent of Phases 3–4 and can run in parallel with Phase 3.

---

## 4. Phase 1 — React UI Foundation

### Tech stack

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Framework | React 18 + TypeScript | Editor ecosystem, typed API client |
| Build | Vite | Fast HMR, clean dist/ output |
| Routing | React Router v6 | SPA, 3 routes |
| State | Zustand | Lightweight, no Redux boilerplate |
| Styles | Tailwind CSS v3 | Utility-first, dark theme native |
| Icons | Lucide React | Lightweight, consistent |
| Data fetching | TanStack Query | Cache, loading states |
| Progress | Polling (`setInterval` 1.5s) | `GET /api/v1/tasks/{id}` returns `progress` + `state`; no SSE endpoint exists |

No external component library. Custom components over Tailwind. Avoids generic look and vendor lock-in.

### Routes

```
/           → AutoFlow   (automatic pipeline)
/editor     → Editor     (Phase 3 skeleton, non-interactive)
/settings   → Settings   (LLM, API keys, TTS)
```

### AutoFlow layout

```
┌─────────────────────────────────────────────────────────┐
│  🎬 TurboPrinter          [Auto] [Editor] [Settings]    │
├──────────────┬──────────────┬──────────────────────────┤
│  SCRIPT      │  VIDEO       │  AUDIO & SUBTÍTULOS      │
│              │              │                          │
│  Tema        │  Fuente      │  TTS server              │
│  Idioma      │  Aspecto     │  Voz                     │
│  [Generar ▶] │  Concat mode │  Volumen / Rate          │
│  textarea    │  Transición  │  BGM                     │
│  Keywords    │  Duración    │  ─────────────           │
│              │  # videos    │  Fuente / Tamaño         │
│              │  [avanzado▼] │  Color / Stroke          │
│              │              │  Posición                │
├──────────────┴──────────────┴──────────────────────────┤
│              [ GENERATE VIDEO ▶ ]                       │
├─────────────────────────────────────────────────────────┤
│  PROGRESO                                               │
│  ████████░░░░  Downloading clips...                     │
│  [log colapsable]                                       │
│  ┌─────────┐                                           │
│  │  video  │  ← inline player                          │
│  └─────────┘                                           │
└─────────────────────────────────────────────────────────┘
```

### Editor skeleton (Phase 1)

Navigable shell with visible but disabled timeline structure. Signals Phase 3 intent without blocking Phase 1 ship.

```
┌─────────────────────────────────────────────────────────┐
│  Editor manual — disponible en Phase 3                  │
│  [preview placeholder]                                  │
│  ──────────────── TIMELINE ─────────────────────────── │
│  [ clip 1 ][ clip 2 ][ clip 3 ][ + ]                   │
│  (estructura visible, interacción deshabilitada)         │
└─────────────────────────────────────────────────────────┘
```

### Settings page

- LLM provider selector + API key + base URL + model name
- Pexels / Pixabay / Coverr API keys (add/remove/mask)
- TTS server + voice preview
- Persists via `POST /api/v1/config` (new endpoint, thin wrapper over `config.save_config()`)

### API client structure

```
webui-react/src/api/
  client.ts      ← fetch base, VITE_API_BASE_URL, error handling
  video.ts       ← generateVideo(), getTask(), listTasks()
  llm.ts         ← generateScript(), generateTerms()
  config.ts      ← getConfig(), saveConfig()
  polling.ts     ← pollTask(taskId, onProgress, onComplete, onError)
                    polls GET /api/v1/tasks/{id} every 1.5s until done/failed
  types.ts       ← VideoParams, TaskResult, LLMProvider, ConfigState
                    (mirrors Python Pydantic schemas)
```

`types.ts` is forward-compatible: Phase 2 adds `ClipPlan`, `OrchestrationParams` without touching AutoFlow.

### Zustand stores

```
store/
  useVideoStore.ts    ← VideoParams (all form fields)
  useTaskStore.ts     ← taskId, status, logs[], progress %, result
  useConfigStore.ts   ← llmProvider, apiKeys, ttsServer, voice
                         (persists to localStorage)
```

### Design tokens

```
Background base:     #0f0f11
Background surface:  #1a1a1f
Background elevated: #24242b
Border:              #2e2e38
Text primary:        #f0f0f3
Text secondary:      #8b8b9a
Accent:              #6366f1   (indigo — generate actions)
Accent hover:        #7c3aed
Success:             #22c55e
Error:               #ef4444
Warning:             #f59e0b
Font body:           Inter (self-hosted)
Font mono:           JetBrains Mono (logs)
```

### Dev workflow

```bash
# Terminal 1
uv run python main.py          # FastAPI on :8080

# Terminal 2
cd webui-react && npm run dev  # Vite on :5173, proxies /api → :8080

# Deploy
cd webui-react && npm run build   # outputs dist/
# FastAPI auto-mounts dist/ on startup
```

`vite.config.ts` proxy:
```ts
server: {
  proxy: {
    '/api': 'http://localhost:8080',
  }
}
```

### New backend endpoints (Phase 1 only)

```
GET  /api/v1/config          ← returns sanitized config (masks API keys to last 4 chars)
POST /api/v1/config          ← saves config subset (thin wrapper over config.save_config())
```

All generation, task, and project endpoints already exist in `app/controllers/v1/`.
Task progress available via polling: `GET /api/v1/tasks/{task_id}` returns `{ progress: int, state: int, videos: [] }`.

---

## 5. Phase 2 — AI Orchestration

### Problem

Current: LLM writes script → generic keyword search → random stock clips. Result: clips thematically related but visually disconnected from narration timing.

### Solution

Script segmented with timestamps → LLM generates per-segment `ClipPlan` (specific query, mood, shot type) → multi-provider parallel search → VisionRanker re-ranks.

### New schema

```python
class ClipPlan(BaseModel):
    segment_text: str
    start_sec: float
    duration_sec: float
    search_query: str      # LLM-generated, more specific than current
    mood: str              # calm / energetic / dramatic / suspense / etc.
    shot_type: str         # wide / close-up / aerial / action / etc.
```

### New endpoints

```
POST /api/v1/llm/orchestrate-clips
  body: { script: str, audio_duration_sec: float }
  returns: ClipPlan[]

POST /api/v1/media/search-multi
  body: { query: str, providers: str[], count: int }
  returns: MediaResult[] (merged, deduplicated)
```

### New services

```
app/services/quality/
  clip_orchestrator.py      ← LLM prompt → ClipPlan[]
  multi_provider_search.py  ← asyncio.gather() across all providers with keys
```

### UI change

AutoFlow: single toggle "AI Orchestration (experimental)". When enabled, generation uses `orchestrate-clips` before media search. Fully opt-in.

---

## 6. Phase 3 — Manual Editor

### Additional frontend dependencies

```
dnd-kit          ← accessible drag-drop (timeline clip reorder)
wavesurfer.js    ← audio waveform visualization
```

### Full editor layout

```
┌──────────────────┬──────────────────────────────────────┐
│  PREVIEW         │  INSPECTOR                           │
│  <video>         │  trim start / end                    │
│  00:03 / 00:45   │  replace (search new)                │
│  scrubber        │  metadata                            │
├──────────────────┴──────────────────────────────────────┤
│  TIMELINE                                               │
│  audio: ▓▓▓▓▒▒▒▒▓▓▓▓▒▒▒▓▓▓▓  (waveform)               │
│  video: [clip1][clip2 ][clip3][clip4]                   │
│          ↑ drag reorder, edges trim                     │
├─────────────────────────────────────────────────────────┤
│  [ ← Back ]                      [ Render ▶ ]          │
└─────────────────────────────────────────────────────────┘
```

### Backend

Project API already exists (`app/controllers/v1/projects.py`). Phase 3 connects React to those endpoints. No new backend work required.

Supported edit commands (already modeled):
- `trim` — adjust clip start/end
- `move` — reorder position in timeline
- `replace` — swap clip for another candidate
- `set_timing` — change duration

---

## 7. Phase 4 — OpenCut Backend

### Goal

Study OpenCut's FFmpeg pipeline for higher-quality transitions and effects. Reimplement in Python, not import TS/Next.js code.

### New services

```
app/services/assembly/
  opencut_renderer.py    ← FFmpeg commands modeled on OpenCut patterns
  effects.py             ← zoom, pan, fade, blur
  transitions.py         ← frame-accurate transitions
```

Toggle in config: `[quality] renderer = "opencut"`. FastAPI backend swaps renderer; UI unchanged.

---

## 8. Phase 5 — Expansions (Reddit + BGM)

### Reddit ingestion

```
app/services/reddit/
  scraper.py        ← PRAW: top posts, thread by URL, AITA/confessions
  formatter.py      ← thread → narration script with dramatic pauses
```

AutoFlow adds third content entry: "From Reddit" with URL or subreddit + filter fields.

### Contextual BGM

```
app/services/bgm/
  freesound_client.py   ← Freesound API (free tier)
  jamendo_client.py     ← Jamendo API (free, CC licensed music)
  bgm_selector.py       ← LLM infers mood → searches API → returns track
```

LLM prompt: *"Given this script about {topic}, what musical mood fits best? Options: ambient / upbeat / dramatic / lo-fi / cinematic"* → query Freesound/Jamendo with mood + script keywords.

---

## 9. Phase dependency graph

```
Phase 1 (React UI)
  └→ Phase 2 (AI Orchestration) — new endpoints, UI adds toggle only
       └→ Phase 3 (Editor) — connects to existing Project API
            └→ Phase 4 (OpenCut renderer) — backend swap, UI unchanged

Phase 5 (Reddit + BGM) — independent, parallelizable with Phase 3
```

---

## 10. What is NOT in scope

- Replacing or modifying `webui/Main.py` (upstream, stays intact)
- GPU-required dependencies
- Authentication / multi-user (single-user LXC deploy)
- Mobile app
- Importing OpenCut TypeScript/Next.js code directly
