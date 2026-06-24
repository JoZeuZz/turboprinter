# TurboPrinter — WebUI React Workspace Redesign

**Date**: 2026-06-24
**Status**: Approved
**Scope**: UI redesign — project-centric workspace (Enfoque C). Design only; implementation in separate plan.
**Supersedes**: `docs/specs/2026-06-23-webui-redesign-design.md` (Phase 1 spec, still valid for backend API contracts)

---

## 1. Context & Motivation

The Phase 1 React UI (AutoFlow + Editor spike + Settings) is functional but has three problems:

1. **Flat layout**: Three equal columns in AutoFlow treat Script, Video settings, and Audio as equally important. Script is the primary concern.
2. **Disconnected flows**: Auto and Editor are independent pages. No natural path from generation to refinement.
3. **No project state visible**: The current UI has no concept of "what state is this generation in" — just a spinner.

The redesign introduces a **project-centric workspace** where every video is a project with explicit state. The UI responds to that state. A human and an agentic AI share the same state machine — the UI is just a renderer of project state, not the source of truth.

---

## 2. Guiding Principle: AI-First Design

Every UI decision must pass this test: **could an AI agent drive this project through the same state machine without the UI?**

The API (`/api/v1/projects/`) already supports `create → plan → mediaSearch → buildTimeline → applyTimelineCommands → render`. The UI makes those transitions visible and optional for humans. Nothing in the UI should require a click that has no API equivalent.

This means:
- Project state lives in the backend, not in React state.
- The UI polls/syncs project state — it does not own it.
- Every action button maps 1:1 to an API call.

---

## 3. Information Architecture

### Routes

```
/                     → Dashboard  (project list + New Project CTA)
/project/new          → Workspace  (fresh project, state: draft)
/project/:id          → Workspace  (existing project, any state)
/settings             → Settings   (global config)
```

Single workspace route. State determines which panel renders in the center. No sub-routes per phase.

### Project State Machine

```
draft
  └→ scripting        AI generating script + keywords
       └→ scripted    Script ready; user configures and launches
            └→ generating   Full pipeline: TTS + media + assembly
                 └→ generated   Clips downloaded, audio ready, no final render yet
                      ├→ editing       User adjusts timeline (optional)
                      │    └→ rendering
                      └→ rendering    Direct render (skip editor)
                           └→ done
                                └→ draft  (new project from same topic)
```

State transitions are driven by API calls. The UI watches state and renders accordingly. An AI agent drives the same transitions without touching the UI.

**State badge colors:**

| State | Color | Label |
|-------|-------|-------|
| draft | `#6b7280` muted | Draft |
| scripting | `#6366f1` indigo | Writing… |
| scripted | `#8b5cf6` violet | Ready |
| generating | `#f59e0b` amber | Generating… |
| generated | `#3b82f6` blue | Review |
| editing | `#6366f1` indigo | Editing |
| rendering | `#f59e0b` amber | Rendering… |
| done | `#22c55e` green | Done |
| error | `#ef4444` red | Error |

---

## 4. Layout Shell

```
┌─────────┬────────────────────────────────────────┐
│         │  TOPIC BAR   [project topic]  [badge]  │
│ SIDEBAR ├────────────────────────────────────────┤
│  200px  │                                        │
│         │         CENTER PANEL                   │
│         │      (state-driven content)            │
│         │                                        │
│         ├────────────────────────────────────────┤
│         │  PIPELINE BAR (fixed, never scrolls)   │
└─────────┴────────────────────────────────────────┘
```

### Sidebar (200px, fixed)

```
┌──────────────────────┐
│  [TP] TurboPrinter   │
│  ─────────────────── │
│  + New Project       │
│  ─────────────────── │
│  ● Beneficios del... │  ← active project
│  ○ Historia de...    │
│  ○ Reddit AITA...    │
│  ─────────────────── │
│  ⚙ Settings          │
└──────────────────────┘
```

- Max 5 recent projects shown; "View all" collapses into a scrollable list
- Active project has filled indicator + bold label
- Project name is the topic, truncated to ~24 chars

### Topic Bar (top, full width minus sidebar)

- Left: project topic, editable inline (click to edit, Enter to save)
- Right: state badge pill

### Pipeline Bar (fixed bottom, full width minus sidebar)

```
  ✓ Script  →  ✓ Settings  →  ⟳ Generate  →  ○ Review  →  ○ Render
```

- Completed steps: checkmark + muted label, clickable to go back
- Active step: spinner + accent label
- Future steps: empty circle + muted label, not clickable
- Does NOT scroll with panel content

---

## 5. Center Panel Designs

### 5.1 Script Panel (states: `draft`, `scripting`, `scripted`)

**Purpose**: Define topic, generate/edit script and keywords.

Layout: single-column, vertically stacked, max-width 640px, centered.

```
  TOPIC
  ┌──────────────────────────────────────────┐
  │  Beneficios del ejercicio matutino       │
  └──────────────────────────────────────────┘

  LANGUAGE          PARAGRAPHS
  [Español   ▾]     [  3  ↑↓ ]

  [⚡ Generate Script + Keywords]   ← secondary action

  ── SCRIPT ──────────────────────────────────
  ┌──────────────────────────────────────────┐
  │ El ejercicio matutino tiene múltiples    │
  │ beneficios para la salud física y mental.│
  │ (auto-resizes)                           │
  └──────────────────────────────────────────┘

  ── KEYWORDS ────────────────────────────────
  ejercicio, salud, metabolismo, mañana

  [▼ Advanced Prompt]
    Script Prompt (textarea)
    System Prompt (textarea)

  [  Continue to Settings  →  ]   ← primary CTA
```

Notes:
- Topic input: no label, placeholder prominent, autofocus on mount
- "Generate Script" is secondary (AI assist), not the primary action
- Section labels: `UPPERCASE 10px tracking-widest text-label`
- Keywords are a simple textarea (comma-separated), not a tag input
- "Continue to Settings" disabled until `video_subject` is non-empty

### 5.2 Settings Panel (state: `scripted`)

**Purpose**: Configure video, audio, subtitles before generation.

Layout: tabbed (Video | Audio | Subtitles), max-width 560px, centered.

```
  Configure your video

  ┌──────────┬──────────┬─────────────┐
  │  Video   │  Audio   │  Subtitles  │
  └──────────┴──────────┴─────────────┘

  [Video tab]
  Source      [Pexels       ▾]
  Aspect      [Portrait 9:16 ▾]
  Order       [Random       ▾]
  Transition  [None         ▾]
  Clip length ────●──── 5s

  [▼ Advanced]
    Video count [1 ↑↓]
    Match clips to script [toggle]

  ──────────────────────────────────────────

  [  ← Back  ]    [  🎬 Generate Video  ]
```

"Generate Video" is the primary CTA here — full accent, large, prominent.
Back returns to Script panel (state stays `scripted`, can re-edit).

### 5.3 Generating Panel (state: `generating`)

**Purpose**: Show pipeline progress; user can monitor or cancel.

Layout: centered column, max-width 480px.

```
  Generating your video

  ████████████████░░░░░░░  68%

  ✓  Script ready
  ✓  Audio (TTS) synthesized
  ✓  Word timestamps extracted
  ⟳  Downloading clips  (5 / 8)
  ○  Assembling video
  ○  Burning subtitles

  [▼ Show logs]
  ┌────────────────────────────────────────┐
  │ 12:43:03  Downloaded clip_003.mp4     │  ← monospace, scroll
  │ 12:43:05  Searching: "metabolismo"    │
  └────────────────────────────────────────┘

  [  ✕ Cancel  ]
```

Steps derive from the task `state` + `progress` fields already returned by `GET /api/v1/tasks/:id`.
Log is collapsible, JetBrains Mono, max-height 120px, scrolled to bottom.

### 5.4 Review Panel (state: `generated`)

**Purpose**: Preview downloaded clips; decide to refine or render directly.

Layout: clip grid (4 columns desktop, 2 mobile), followed by CTA row.

```
  Review clips  ·  8 clips  ·  ~45s total

  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
  │ img  │  │ img  │  │ img  │  │ img  │
  │  ▶   │  │  ▶   │  │  ✗   │  │  ▶   │
  │  5s  │  │  4s  │  │  6s  │  │  5s  │
  └──────┘  └──────┘  └──────┘  └──────┘
   #1 ✓      #2 ✓      #3 ✗      #4 ✓

  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
  │ img  │  │ img  │  │ img  │  │ img  │
  │  ▶   │  │  ▶   │  │  ▶   │  │  ▶   │
  │  4s  │  │  5s  │  │  5s  │  │  4s  │
  └──────┘  └──────┘  └──────┘  └──────┘
   #5 ✓      #6 ✓      #7 ✓      #8 ✓

  [  ✏ Edit in Timeline  ]   [  Render ▶  ]
```

- Hover clip → show ▶ play button + ✗ exclude button as overlay
- Excluded clips are visually dimmed (opacity-40) with strikethrough index
- Exclusion state is local (React) until "Edit in Timeline" or "Render" is pressed; at that point exclusions are sent as `applyTimelineCommands` calls (command type `remove`) before transitioning state
- Thumbnail: first frame of clip (served via `/api/v1/projects/:id/clips/:clip_id/thumbnail`); if endpoint unavailable, fallback to solid color block derived from clip index
- If thumbnail unavailable → solid color block with clip index

### 5.5 Editor Panel (state: `editing`)

**Purpose**: Reorder clips, trim, preview — before final render.

Layout: two-column top (Preview 60% + Inspector 40%) + Timeline strip at bottom.

```
  ┌─────────────────────┬─────────────────────┐
  │  PREVIEW            │  INSPECTOR          │
  │  ┌───────────────┐  │  Clip #3            │
  │  │               │  │  ─────────────────  │
  │  │  video frame  │  │  Start  [0.0]  s    │
  │  │               │  │  End    [6.1]  s    │
  │  │  00:08 / 0:45 │  │                     │
  │  │  ──●──────── │  │  [↺ Replace clip]   │
  │  └───────────────┘  │  [✕ Remove]         │
  │  ■ ▶ |◀  ▶|        │                     │
  └─────────────────────┴─────────────────────┘
  ── TIMELINE ─────────────────────────────────
  ♫  ▓▓▒▒▓▓▓▒▒▒▒▓▓▒▒▓▓  (waveform — wavesurfer.js)
  ▶  [clip1][  clip2  ][ 3 ][clip4][clip5]
        drag to reorder · edge handles to trim

  [← Back to Review]                [Render ▶]
```

Notes:
- Timeline is fixed height (120px), anchored to bottom of panel
- Waveform above clip track; both are horizontally aligned
- Clip pill width = proportional to duration
- Active clip (in preview) has accent-colored border
- Drag-and-drop via dnd-kit (already in Phase 3 spec)
- Inspector fields are controlled inputs; save on blur
- "Replace clip" opens a search modal (Phase 3 detail)

### 5.6 Done Panel (state: `done`)

**Purpose**: Show result, download, or start a new iteration.

```
  ✓  Video ready

  ┌──────────────────────────────────────────┐
  │                                          │
  │            [ video player ]              │
  │                                          │
  └──────────────────────────────────────────┘

  [↓ Download]   [↺ New from same topic]   [✏ Edit]
```

---

## 6. Settings Page (`/settings`)

Standalone page, not part of the workspace. Organized in collapsible sections with inline save.

### Sections

**LLM Provider**
- Provider select (DeepSeek, OpenAI, Gemini, Groq, Ollama, custom)
- Model name input
- API Key input (masked, toggle reveal, save independently)
- Base URL input (shown only for Ollama/custom)

**Media APIs**
- Per-provider: API key masked input + save; if no key, show "+ Add key"
- Providers: Pexels, Pixabay, Coverr

**TTS**
- Server select (edge-tts, azure, local)
- Voice select (filtered by language)
- Preview button (calls `/api/v1/audio` with sample text)

**Quality Stack**
- Global toggle: `quality.enabled`
- Local library toggle: `quality.use_local_library`

### ApiKeyInput behavior
- Default: shows `••••••••` + "Edit" button
- "Edit" click: reveals input, shows "Save" and "Cancel"
- Save: `POST /api/v1/config` with only the changed key
- Cancel: reverts to masked display

---

## 7. Design Tokens (additions to existing)

Extends the current Tailwind config. Existing tokens unchanged.

```ts
// tailwind.config.ts additions
colors: {
  // existing: base, surface, surface-2, border, accent, accent-hover, muted, foreground
  'surface-elevated': '#2a2a32',   // cards inside panels
  'text-label': '#5a5a6e',         // section labels (UPPERCASE)
  'state-scripting': '#6366f1',
  'state-ready': '#8b5cf6',
  'state-generating': '#f59e0b',
  'state-review': '#3b82f6',
  'state-editing': '#6366f1',
  'state-rendering': '#f59e0b',
  'state-done': '#22c55e',
  'state-error': '#ef4444',
}
```

Typography additions:
```css
.label-uppercase {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-label);
}
```

---

## 8. New Components

| Component | Path | Replaces / New |
|-----------|------|----------------|
| `ProjectSidebar` | `components/layout/ProjectSidebar.tsx` | New |
| `TopicBar` | `components/layout/TopicBar.tsx` | New |
| `PipelineBar` | `components/layout/PipelineBar.tsx` | New |
| `StateBadge` | `components/ui/StateBadge.tsx` | New |
| `StepLog` | `components/panels/StepLog.tsx` | New (Generating panel) |
| `ClipGrid` | `components/panels/ClipGrid.tsx` | New (Review panel) |
| `Timeline` | `components/editor/Timeline.tsx` | New |
| `ClipInspector` | `components/editor/ClipInspector.tsx` | New |
| `VideoPreview` | `components/editor/VideoPreview.tsx` | New |
| `ApiKeyInput` | `components/ui/ApiKeyInput.tsx` | New |
| `TabBar` | `components/ui/TabBar.tsx` | New (Settings tabs) |
| `WorkspaceLayout` | `components/layout/WorkspaceLayout.tsx` | Replaces `Layout.tsx` |

Existing panels (`ScriptPanel`, `VideoSettingsPanel`, `AudioSubtitlePanel`, `ProgressArea`, `ResultArea`) are refactored to fit the new state-driven structure but their logic is preserved.

---

## 9. Routing & Store Changes

### Route changes

Current:
```
/           → AutoFlow.tsx
/editor     → Editor.tsx
/settings   → Settings.tsx
```

New:
```
/                     → Dashboard.tsx       (new)
/project/new          → Workspace.tsx       (new, state: draft)
/project/:id          → Workspace.tsx       (new, any state)
/settings             → Settings.tsx        (refactored)
```

`AutoFlow.tsx` and `Editor.tsx` are retired; their logic migrates into Workspace panels.

### Store changes

New store: `useProjectWorkspaceStore.ts`
- `projectId: string | null`
- `projectState: ProjectState`   (enum matching state machine)
- `currentPanel: PanelKey`       (derived from projectState)
- Merges what was split across `useTaskStore`, `useVideoStore`, `useProjectStore`

`useVideoStore` and `useTaskStore` stay but become "form stores" only (holding the form field values), not the source of project lifecycle truth.

---

## 10. Required Backend Endpoints Not Yet Implemented

These endpoints are needed by the new UI but do not exist yet. Must be added before or alongside the UI implementation:

| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `GET /api/v1/projects` | Dashboard project list | Required |
| `GET /api/v1/projects/:id/clips/:clip_id/thumbnail` | Clip preview image | Nice-to-have (fallback exists) |

The `GET /api/v1/projects` endpoint should return `[{ project_id, topic, state, created_at }]` for the 20 most recent projects.

---

## 11. What Is NOT in This Spec

- dnd-kit implementation details (see Phase 3 spec)
- wavesurfer.js waveform implementation
- Backend thumbnail endpoint for clip preview
- "Replace clip" search modal implementation
- Multi-provider search UI (Phase 2)
- Reddit ingestion UI (Phase 5)
- Mobile/responsive layout (single-user desktop deploy)

These are noted as future work but out of scope for this redesign implementation.

---

## 12. Migration Path

Phase 1 code is preserved. The migration is additive:

1. Add new routes + `WorkspaceLayout`
2. Add new stores (`useProjectWorkspaceStore`)
3. Refactor panels to fit new layout (no logic rewrite)
4. Retire `AutoFlow.tsx` + `Editor.tsx` only after new Workspace is verified
5. Settings page refactored in place

The old routes (`/`, `/editor`) can redirect to `/project/new` during transition.

---

## 13. Acceptance Criteria

- [ ] Dashboard shows recent projects (or empty state with CTA)
- [ ] New project creates a project via API, lands in Script panel
- [ ] Pipeline bar reflects current project state at all times
- [ ] Each panel renders correctly for its state
- [ ] Generate button calls existing `POST /api/v1/videos` endpoint
- [ ] Generating panel shows step-by-step progress
- [ ] Review panel shows clip grid (thumbnails or fallback colors)
- [ ] "Edit in Timeline" transitions to editing state
- [ ] Timeline shows clips as draggable pills
- [ ] "Render" from any post-generated state calls render API
- [ ] Done panel shows video player + download
- [ ] Settings page allows inline editing of LLM provider + API keys
- [ ] All existing AutoFlow functionality (script gen, video gen, progress, result) works in new layout
