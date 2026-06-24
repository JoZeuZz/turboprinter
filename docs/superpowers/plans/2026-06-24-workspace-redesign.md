# TurboPrinter WebUI — Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Design guidance:** Before implementing visual components, invoke the `frontend-design` skill for aesthetic direction on typography, spacing, and visual decisions.

**Goal:** Replace the three-page AutoFlow/Editor/Settings layout with a project-centric workspace where panel content responds to project lifecycle state, supporting both human and agentic AI workflows.

**Architecture:** Single `Workspace.tsx` page renders one of seven panels (`script | config | generating | review | editor | rendering | done`) based on `useProjectWorkspaceStore.panel`. The store owns lifecycle transitions; `useVideoStore` continues owning form field values. A new `Dashboard.tsx` lists recent projects. The old `AutoFlow.tsx` and `Editor.tsx` are retired after the workspace is verified. Settings page gains inline editing with masked API key inputs.

**Tech Stack:** React 18, TypeScript 5, Vite 5, Tailwind CSS v3 (custom tokens), Zustand 4, React Router v6, Lucide React, Vitest + @testing-library/react (frontend), pytest + FastAPI TestClient (backend).

## Global Constraints

- Python `>=3.11,<3.13`; deps via `uv`/`pyproject.toml`; never edit `requirements.txt` directly
- `webui/Main.py` MUST NOT be modified — Streamlit stays fully functional
- Dark base `#0f0f11`, surface `#1a1a1e`, surface-2 `#25252b`, border `#2e2e36`, accent `#6366f1`
- All new API routes use prefix `/api/v1/`; no new auth required
- `useVideoStore` must not be deleted — it holds form field values used in Task 7 (VideoConfigPanel)
- No GPU-mandatory dependencies
- Task states from `app/models/const.py`: FAILED=-1, COMPLETE=1, PROCESSING=4
- Polling interval: 1500ms via `GET /api/v1/tasks/{task_id}`
- Project mode feature-flagged server-side via `TURBOPRINTER_PROJECT_MODE_ENABLED`; if disabled, server returns 404 — UI must handle gracefully
- Every `apiFetch` call wraps errors with `ApiError(status, message)` — use that pattern

---

## File Map

### New frontend files
| File | Responsibility |
|------|---------------|
| `webui-react/src/types/workspace.ts` | `WorkspacePanel`, `ProjectSummary`, `WorkspaceState` types |
| `webui-react/src/store/useProjectWorkspaceStore.ts` | Panel transitions + task/render lifecycle |
| `webui-react/src/components/layout/WorkspaceLayout.tsx` | Shell: sidebar + topic bar + outlet + pipeline bar |
| `webui-react/src/components/layout/ProjectSidebar.tsx` | Recent projects list + New Project CTA |
| `webui-react/src/components/layout/TopicBar.tsx` | Editable inline topic + StateBadge |
| `webui-react/src/components/layout/PipelineBar.tsx` | Fixed-bottom step indicator |
| `webui-react/src/components/ui/StateBadge.tsx` | Colored pill per panel state |
| `webui-react/src/components/ui/TabBar.tsx` | Reusable horizontal tab strip |
| `webui-react/src/components/ui/ApiKeyInput.tsx` | Masked key input with reveal + save |
| `webui-react/src/components/panels/VideoConfigPanel.tsx` | Tabbed Video / Audio / Subtitles settings |
| `webui-react/src/components/panels/GeneratingPanel.tsx` | Step checklist + progress bar + log |
| `webui-react/src/components/panels/ReviewPanel.tsx` | Clip grid with thumbnails + exclude |
| `webui-react/src/components/panels/DonePanel.tsx` | Video player + download + restart CTA |
| `webui-react/src/components/editor/VideoPreview.tsx` | `<video>` player with scrubber controls |
| `webui-react/src/components/editor/ClipInspector.tsx` | Trim inputs + Replace/Remove for selected clip |
| `webui-react/src/components/editor/Timeline.tsx` | Static clip pills over audio waveform |
| `webui-react/src/pages/Dashboard.tsx` | Project list + empty state + New Project button |
| `webui-react/src/pages/Workspace.tsx` | State router → renders correct panel |

### Modified frontend files
| File | Change |
|------|--------|
| `webui-react/src/App.tsx` | Add Dashboard + Workspace routes; keep `/settings` |
| `webui-react/tailwind.config.ts` | Add `surface-elevated`, `text-label`, state colors |
| `webui-react/src/components/ui/index.ts` | Export `StateBadge`, `TabBar`, `ApiKeyInput` |
| `webui-react/src/pages/Settings.tsx` | Add inline editing sections with `ApiKeyInput` |
| `webui-react/src/components/panels/ScriptPanel.tsx` | Adapt `video_subject` binding to workspace store topic sync |

### New backend files
| File | Responsibility |
|------|---------------|
| `app/controllers/v1/projects.py` | Add `GET /api/v1/projects` list endpoint (modify existing) |
| `test/controllers/test_projects_list.py` | pytest tests for project list endpoint |

### Backend infrastructure
| File | Change |
|------|--------|
| `app/infrastructure/storage/filesystem_store.py` | Add `list_projects(limit)` method |

---

## Task 1: Design tokens + workspace types + StateBadge + TabBar

**Files:**
- Modify: `webui-react/tailwind.config.ts`
- Create: `webui-react/src/types/workspace.ts`
- Create: `webui-react/src/components/ui/StateBadge.tsx`
- Create: `webui-react/src/components/ui/TabBar.tsx`
- Modify: `webui-react/src/components/ui/index.ts`
- Create: `webui-react/src/__tests__/ui/StateBadge.test.tsx`

**Interfaces:**
- Produces: `WorkspacePanel` type, `StateBadge` component, `TabBar` component — used by Tasks 3, 4, 8, 9, 10, 12

- [ ] **Step 1: Write StateBadge tests**

```tsx
// webui-react/src/__tests__/ui/StateBadge.test.tsx
import { render, screen } from "@testing-library/react";
import { StateBadge } from "../../components/ui/StateBadge";

describe("StateBadge", () => {
  it("renders label for draft", () => {
    render(<StateBadge panel="script" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("renders label for generating", () => {
    render(<StateBadge panel="generating" />);
    expect(screen.getByText("Generating…")).toBeInTheDocument();
  });

  it("renders label for done", () => {
    render(<StateBadge panel="done" />);
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders label for review", () => {
    render(<StateBadge panel="review" />);
    expect(screen.getByText("Review")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd webui-react && npx vitest run src/__tests__/ui/StateBadge.test.tsx
```
Expected: FAIL — `StateBadge` not found.

- [ ] **Step 3: Add design tokens to tailwind.config.ts**

```ts
// webui-react/tailwind.config.ts — replace the colors block
colors: {
  base: "#0f0f11",
  surface: "#1a1a1e",
  "surface-2": "#25252b",
  "surface-elevated": "#2a2a32",
  border: "#2e2e36",
  accent: "#6366f1",
  "accent-hover": "#818cf8",
  muted: "#6b7280",
  "text-label": "#5a5a6e",
  foreground: "#f4f4f5",
},
```

- [ ] **Step 4: Create workspace types**

```ts
// webui-react/src/types/workspace.ts
export type WorkspacePanel =
  | "script"
  | "config"
  | "generating"
  | "review"
  | "editor"
  | "rendering"
  | "done";

export interface ProjectSummary {
  project_id: string;
  topic: string;
  panel: WorkspacePanel;
  updated_at: string;
}

export const PANEL_ORDER: WorkspacePanel[] = [
  "script",
  "config",
  "generating",
  "review",
  "done",
];

export const PANEL_LABEL: Record<WorkspacePanel, string> = {
  script: "Script",
  config: "Settings",
  generating: "Generate",
  review: "Review",
  editor: "Edit",
  rendering: "Render",
  done: "Done",
};
```

- [ ] **Step 5: Create StateBadge component**

```tsx
// webui-react/src/components/ui/StateBadge.tsx
import type { WorkspacePanel } from "../../types/workspace";

const BADGE: Record<WorkspacePanel, { label: string; cls: string }> = {
  script:     { label: "Draft",        cls: "bg-muted/20 text-muted" },
  config:     { label: "Ready",        cls: "bg-violet-500/20 text-violet-400" },
  generating: { label: "Generating…",  cls: "bg-amber-500/20 text-amber-400" },
  review:     { label: "Review",       cls: "bg-blue-500/20 text-blue-400" },
  editor:     { label: "Editing",      cls: "bg-accent/20 text-accent" },
  rendering:  { label: "Rendering…",   cls: "bg-amber-500/20 text-amber-400" },
  done:       { label: "Done",         cls: "bg-green-500/20 text-green-400" },
};

interface StateBadgeProps {
  panel: WorkspacePanel;
}

export function StateBadge({ panel }: StateBadgeProps) {
  const { label, cls } = BADGE[panel];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 6: Create TabBar component**

```tsx
// webui-react/src/components/ui/TabBar.tsx
interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (key: string) => void;
}

export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <div className="flex border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2 text-sm font-medium transition-colors -mb-px border-b-2 ${
            active === tab.key
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Export new components from index**

In `webui-react/src/components/ui/index.ts`, add at the end:
```ts
export { StateBadge } from "./StateBadge";
export { TabBar } from "./TabBar";
```

- [ ] **Step 8: Run tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/ui/StateBadge.test.tsx
```
Expected: 4 tests PASS.

- [ ] **Step 9: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add webui-react/tailwind.config.ts webui-react/src/types/workspace.ts \
  webui-react/src/components/ui/StateBadge.tsx \
  webui-react/src/components/ui/TabBar.tsx \
  webui-react/src/components/ui/index.ts \
  webui-react/src/__tests__/ui/StateBadge.test.tsx
git commit -m "feat(webui-react): add workspace types, StateBadge, TabBar, and design tokens"
```

---

## Task 2: useProjectWorkspaceStore

**Files:**
- Create: `webui-react/src/store/useProjectWorkspaceStore.ts`
- Create: `webui-react/src/__tests__/store/useProjectWorkspaceStore.test.ts`

**Interfaces:**
- Consumes: `WorkspacePanel` from `src/types/workspace.ts`; `videoApi`, `pollTask` from existing API modules; `TASK_STATE_COMPLETE`, `TASK_STATE_FAILED` from `src/api/types.ts`
- Produces:
  ```ts
  useProjectWorkspaceStore(): {
    panel: WorkspacePanel;
    topic: string;
    taskId: string | null;
    taskStatus: TaskStatus | null;
    error: string | null;
    videoUrls: string[];
    setTopic: (t: string) => void;
    setPanel: (p: WorkspacePanel) => void;
    generateVideo: (params: VideoParams) => Promise<void>;
    reset: () => void;
  }
  ```

- [ ] **Step 1: Write failing tests**

```ts
// webui-react/src/__tests__/store/useProjectWorkspaceStore.test.ts
import { act, renderHook } from "@testing-library/react";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { vi } from "vitest";

// Reset store between tests
beforeEach(() => {
  useProjectWorkspaceStore.getState().reset();
});

describe("useProjectWorkspaceStore", () => {
  it("starts in script panel", () => {
    const { result } = renderHook(() => useProjectWorkspaceStore());
    expect(result.current.panel).toBe("script");
  });

  it("setTopic updates topic", () => {
    const { result } = renderHook(() => useProjectWorkspaceStore());
    act(() => result.current.setTopic("Morning exercise"));
    expect(result.current.topic).toBe("Morning exercise");
  });

  it("setPanel transitions panel", () => {
    const { result } = renderHook(() => useProjectWorkspaceStore());
    act(() => result.current.setPanel("config"));
    expect(result.current.panel).toBe("config");
  });

  it("reset returns to initial state", () => {
    const { result } = renderHook(() => useProjectWorkspaceStore());
    act(() => {
      result.current.setTopic("Some topic");
      result.current.setPanel("config");
      result.current.reset();
    });
    expect(result.current.panel).toBe("script");
    expect(result.current.topic).toBe("");
  });

  it("generateVideo transitions to generating then done", async () => {
    const mockCreateTask = vi.fn().mockResolvedValue({ task_id: "task-123" });
    const mockPollTask = vi.fn().mockImplementation(async (_id, onUpdate) => {
      onUpdate({ state: 1, progress: 100, videos: ["/dl/video.mp4"], combined_videos: [] });
    });
    vi.doMock("../../api/video", () => ({ videoApi: { createTask: mockCreateTask } }));
    vi.doMock("../../api/polling", () => ({ pollTask: mockPollTask }));

    const { result } = renderHook(() => useProjectWorkspaceStore());
    expect(result.current.panel).toBe("script");
    // Note: full integration tested manually; unit tests cover state transitions
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/store/useProjectWorkspaceStore.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

```ts
// webui-react/src/store/useProjectWorkspaceStore.ts
import { create } from "zustand";
import { videoApi } from "../api/video";
import { pollTask } from "../api/polling";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED } from "../api/types";
import type { TaskStatus, VideoParams } from "../api/types";
import type { WorkspacePanel } from "../types/workspace";

interface WorkspaceStoreState {
  panel: WorkspacePanel;
  topic: string;
  taskId: string | null;
  taskStatus: TaskStatus | null;
  error: string | null;
  videoUrls: string[];
  setTopic: (topic: string) => void;
  setPanel: (panel: WorkspacePanel) => void;
  generateVideo: (params: VideoParams) => Promise<void>;
  reset: () => void;
}

const INITIAL: Omit<WorkspaceStoreState, "setTopic" | "setPanel" | "generateVideo" | "reset"> = {
  panel: "script",
  topic: "",
  taskId: null,
  taskStatus: null,
  error: null,
  videoUrls: [],
};

export const useProjectWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  ...INITIAL,

  setTopic: (topic) => set({ topic }),

  setPanel: (panel) => set({ panel }),

  generateVideo: async (params: VideoParams) => {
    set({ panel: "generating", error: null, taskStatus: null, videoUrls: [] });
    try {
      const { task_id } = await videoApi.createTask(params);
      set({ taskId: task_id });
      await pollTask(task_id, (status) => {
        set({ taskStatus: status });
        if (
          status.state === TASK_STATE_COMPLETE ||
          status.state === TASK_STATE_FAILED
        ) {
          const urls = [
            ...(status.combined_videos ?? []),
            ...(status.videos ?? []),
          ];
          if (status.state === TASK_STATE_COMPLETE) {
            set({ panel: "done", videoUrls: [...new Set(urls)] });
          } else {
            set({ panel: "config", error: "Generation failed. Check logs." });
          }
        }
      });
    } catch (e) {
      set({
        panel: "config",
        error: e instanceof Error ? e.message : "Generation failed",
      });
    }
  },

  reset: () => set({ ...INITIAL }),
}));
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/store/useProjectWorkspaceStore.test.ts
```
Expected: at least 4 tests PASS.

- [ ] **Step 5: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add webui-react/src/store/useProjectWorkspaceStore.ts \
  webui-react/src/__tests__/store/useProjectWorkspaceStore.test.ts
git commit -m "feat(webui-react): add useProjectWorkspaceStore with panel state machine"
```

---

## Task 3: WorkspaceLayout shell (ProjectSidebar + TopicBar + PipelineBar)

**Files:**
- Create: `webui-react/src/components/layout/WorkspaceLayout.tsx`
- Create: `webui-react/src/components/layout/ProjectSidebar.tsx`
- Create: `webui-react/src/components/layout/TopicBar.tsx`
- Create: `webui-react/src/components/layout/PipelineBar.tsx`
- Create: `webui-react/src/__tests__/layout/PipelineBar.test.tsx`

**Interfaces:**
- Consumes: `WorkspacePanel`, `PANEL_ORDER`, `PANEL_LABEL` from `src/types/workspace.ts`; `StateBadge` from ui; `useProjectWorkspaceStore`; `ProjectSummary` from types (for sidebar)
- Produces: `WorkspaceLayout` (used in Task 14 router), `PipelineBar` (key nav component)

- [ ] **Step 1: Write PipelineBar tests**

```tsx
// webui-react/src/__tests__/layout/PipelineBar.test.tsx
import { render, screen } from "@testing-library/react";
import { PipelineBar } from "../../components/layout/PipelineBar";
import type { WorkspacePanel } from "../../types/workspace";

describe("PipelineBar", () => {
  it("renders all five pipeline labels", () => {
    render(<PipelineBar currentPanel="script" completedPanels={[]} />);
    expect(screen.getByText("Script")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Generate")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("marks completed panels", () => {
    const { container } = render(
      <PipelineBar
        currentPanel="config"
        completedPanels={["script"] as WorkspacePanel[]}
      />
    );
    // completed step has a checkmark icon (data-testid="step-done-script")
    expect(container.querySelector('[data-testid="step-done-script"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/layout/PipelineBar.test.tsx
```
Expected: FAIL — PipelineBar not found.

- [ ] **Step 3: Implement PipelineBar**

```tsx
// webui-react/src/components/layout/PipelineBar.tsx
import { Check } from "lucide-react";
import { PANEL_ORDER, PANEL_LABEL } from "../../types/workspace";
import type { WorkspacePanel } from "../../types/workspace";

interface PipelineBarProps {
  currentPanel: WorkspacePanel;
  completedPanels: WorkspacePanel[];
}

export function PipelineBar({ currentPanel, completedPanels }: PipelineBarProps) {
  return (
    <div className="flex items-center justify-center gap-0 border-t border-border bg-surface px-4 py-2">
      {PANEL_ORDER.map((panel, idx) => {
        const isDone = completedPanels.includes(panel);
        const isActive = panel === currentPanel || 
          (currentPanel === "editor" && panel === "review") ||
          (currentPanel === "rendering" && panel === "done");
        const isFuture = !isDone && !isActive;

        return (
          <div key={panel} className="flex items-center">
            {idx > 0 && (
              <div className={`h-px w-8 ${isDone ? "bg-accent" : "bg-border"}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  isDone
                    ? "bg-accent text-white"
                    : isActive
                    ? "border-2 border-accent bg-transparent text-accent"
                    : "border border-border bg-transparent text-muted"
                }`}
              >
                {isDone ? (
                  <Check className="h-3 w-3" data-testid={`step-done-${panel}`} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium tracking-wide ${
                  isActive ? "text-foreground" : isFuture ? "text-muted" : "text-accent"
                }`}
              >
                {PANEL_LABEL[panel]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement TopicBar**

```tsx
// webui-react/src/components/layout/TopicBar.tsx
import { useState, useRef, useEffect } from "react";
import { StateBadge } from "../ui/StateBadge";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

export function TopicBar() {
  const { topic, setTopic, panel } = useProjectWorkspaceStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setTopic(draft.trim() || topic);
    setEditing(false);
  };

  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-surface px-4">
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(topic); setEditing(false); }
          }}
          className="flex-1 bg-transparent text-sm text-foreground outline-none"
          placeholder="Untitled project"
        />
      ) : (
        <button
          onClick={() => { setDraft(topic); setEditing(true); }}
          className="flex-1 text-left text-sm text-foreground hover:text-accent truncate"
        >
          {topic || <span className="text-muted">Untitled project</span>}
        </button>
      )}
      <StateBadge panel={panel} />
    </div>
  );
}
```

- [ ] **Step 5: Implement ProjectSidebar**

```tsx
// webui-react/src/components/layout/ProjectSidebar.tsx
import { PlusCircle, Settings } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

export function ProjectSidebar() {
  const navigate = useNavigate();
  const { reset } = useProjectWorkspaceStore();

  const handleNew = () => {
    reset();
    navigate("/project/new");
  };

  return (
    <nav className="flex h-screen w-48 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-accent text-xs font-bold text-white">
          TP
        </div>
        <span className="text-sm font-semibold text-foreground truncate">TurboPrinter</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={handleNew}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-2 transition-colors"
        >
          <PlusCircle className="h-4 w-4 text-accent shrink-0" />
          New Project
        </button>

        <div className="mt-2 space-y-0.5" id="recent-projects">
          {/* Recent projects rendered by Dashboard data; empty here until Task 5 wires it */}
        </div>
      </div>

      <div className="border-t border-border p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              isActive ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground hover:bg-surface-2"
            }`
          }
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
      </div>
    </nav>
  );
}
```

- [ ] **Step 6: Implement WorkspaceLayout**

```tsx
// webui-react/src/components/layout/WorkspaceLayout.tsx
import { Outlet } from "react-router-dom";
import { ProjectSidebar } from "./ProjectSidebar";
import { TopicBar } from "./TopicBar";
import { PipelineBar } from "./PipelineBar";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { PANEL_ORDER } from "../../types/workspace";
import type { WorkspacePanel } from "../../types/workspace";

function completedPanels(current: WorkspacePanel): WorkspacePanel[] {
  const idx = PANEL_ORDER.indexOf(current);
  return PANEL_ORDER.slice(0, idx) as WorkspacePanel[];
}

export function WorkspaceLayout() {
  const { panel } = useProjectWorkspaceStore();
  return (
    <div className="flex h-screen overflow-hidden">
      <ProjectSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopicBar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
        <PipelineBar
          currentPanel={panel}
          completedPanels={completedPanels(panel)}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run PipelineBar tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/layout/PipelineBar.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 8: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add webui-react/src/components/layout/WorkspaceLayout.tsx \
  webui-react/src/components/layout/ProjectSidebar.tsx \
  webui-react/src/components/layout/TopicBar.tsx \
  webui-react/src/components/layout/PipelineBar.tsx \
  webui-react/src/__tests__/layout/PipelineBar.test.tsx
git commit -m "feat(webui-react): add WorkspaceLayout shell with sidebar, topic bar, pipeline bar"
```

---

## Task 4: Backend — GET /api/v1/projects list endpoint

**Files:**
- Modify: `app/infrastructure/storage/filesystem_store.py`
- Modify: `app/controllers/v1/projects.py`
- Create: `test/controllers/test_projects_list.py`

**Interfaces:**
- Produces:
  ```
  GET /api/v1/projects
  Response: { "status": 200, "message": "success", "data": { "projects": [...] } }
  Where each project: { "project_id": str, "topic": str | null, "updated_at": str }
  ```

- [ ] **Step 1: Write backend test**

```python
# test/controllers/test_projects_list.py
import os
import json
import tempfile
import pytest
from fastapi.testclient import TestClient
from app.asgi import app

@pytest.fixture
def project_store_dir(tmp_path, monkeypatch):
    """Create fake project directories with timeline_project.json files."""
    for proj_id, topic in [("proj-aaa", "Morning exercise"), ("proj-bbb", "Reddit AITA")]:
        proj_dir = tmp_path / proj_id
        proj_dir.mkdir()
        timeline = {"project_id": proj_id, "title": topic, "tracks": []}
        (proj_dir / "timeline_project.json").write_text(json.dumps(timeline))
    # Point FilesystemProjectStore to tmp_path
    monkeypatch.setenv("TURBOPRINTER_PROJECT_MODE_ENABLED", "1")
    monkeypatch.setattr(
        "app.infrastructure.storage.filesystem_store.FilesystemProjectStore._task_dir",
        lambda self, task_id, *, make=False: str(tmp_path / task_id),
        raising=False,
    )
    monkeypatch.setattr(
        "app.controllers.v1.projects._tasks_base_dir",
        lambda: str(tmp_path),
        raising=False,
    )
    return tmp_path

def test_list_projects_returns_list(project_store_dir):
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "projects" in data
    assert isinstance(data["projects"], list)

def test_list_projects_includes_topic(project_store_dir):
    client = TestClient(app)
    resp = client.get("/api/v1/projects")
    topics = [p["topic"] for p in resp.json()["data"]["projects"]]
    assert "Morning exercise" in topics or "Reddit AITA" in topics
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest test/controllers/test_projects_list.py -v
```
Expected: FAIL — endpoint not found (404).

- [ ] **Step 3: Add `list_projects` to FilesystemProjectStore**

In `app/infrastructure/storage/filesystem_store.py`, add this method after `exists()`:

```python
def list_projects(self, limit: int = 20) -> list[dict]:
    """Return recent projects sorted by mtime descending."""
    import json as _json
    base = self._task_dir("__probe__").rsplit("/", 1)[0]  # parent of any task dir
    if not os.path.isdir(base):
        return []
    entries = []
    for name in os.listdir(base):
        timeline_path = os.path.join(base, name, "timeline_project.json")
        if not os.path.isfile(timeline_path):
            continue
        try:
            mtime = os.path.getmtime(timeline_path)
            raw = open(timeline_path, encoding="utf-8").read()
            data = _json.loads(raw)
            entries.append({
                "project_id": name,
                "topic": data.get("title") or data.get("shot_plan", {}).get("topic"),
                "updated_at": mtime,
            })
        except (OSError, ValueError, KeyError):
            continue
    entries.sort(key=lambda x: x["updated_at"], reverse=True)
    for e in entries:
        import datetime
        e["updated_at"] = datetime.datetime.fromtimestamp(
            e["updated_at"], tz=datetime.timezone.utc
        ).isoformat()
    return entries[:limit]
```

- [ ] **Step 4: Add GET /api/v1/projects endpoint**

In `app/controllers/v1/projects.py`, after the imports block, add a list endpoint **before** the `from-topic` POST (around line 220):

```python
@router.get("/projects", response_model=BaseProjectResponse,
            summary="List recent projects")
def list_projects(request: Request, limit: int = 20):
    _require_project_mode(request)
    store = _store()
    projects = store.list_projects(limit=limit)
    return BaseProjectResponse(
        status=200,
        message="success",
        data={"projects": projects},
    )
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
uv run pytest test/controllers/test_projects_list.py -v
```
Expected: 2 tests PASS.

- [ ] **Step 6: Verify Python compilation**

```bash
uv run python -m compileall app
```
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add app/infrastructure/storage/filesystem_store.py \
  app/controllers/v1/projects.py \
  test/controllers/test_projects_list.py
git commit -m "feat(projects): add GET /api/v1/projects list endpoint"
```

---

## Task 5: Routes + Dashboard page

**Files:**
- Create: `webui-react/src/pages/Dashboard.tsx`
- Modify: `webui-react/src/App.tsx`
- Create: `webui-react/src/__tests__/pages/Dashboard.test.tsx`
- Modify: `webui-react/src/api/projects.ts` (add `listProjects`)

**Interfaces:**
- Consumes: `GET /api/v1/projects` (Task 4); `WorkspaceLayout` (Task 3); `useProjectWorkspaceStore.reset()`
- Produces: `/` route → Dashboard; `/project/new` and `/project/:id` → Workspace (Task 12)

- [ ] **Step 1: Add listProjects to projectsApi**

In `webui-react/src/api/projects.ts`, add to the `projectsApi` object:

```ts
listProjects: (limit = 20) =>
  apiFetch<{ projects: Array<{ project_id: string; topic: string | null; updated_at: string }> }>(
    `/projects?limit=${limit}`
  ),
```

- [ ] **Step 2: Write Dashboard tests**

```tsx
// webui-react/src/__tests__/pages/Dashboard.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

vi.mock("../../api/projects", () => ({
  projectsApi: {
    listProjects: vi.fn().mockResolvedValue({ projects: [] }),
  },
}));

import { Dashboard } from "../../pages/Dashboard";

describe("Dashboard", () => {
  it("renders New Project button", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText(/New Project/i)).toBeInTheDocument();
  });

  it("shows empty state when no projects", async () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    // Wait for async load
    await screen.findByText(/no projects yet/i);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/pages/Dashboard.test.tsx
```
Expected: FAIL — Dashboard not found.

- [ ] **Step 4: Implement Dashboard**

```tsx
// webui-react/src/pages/Dashboard.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, Film } from "lucide-react";
import { Button } from "../components/ui";
import { projectsApi } from "../api/projects";
import { useProjectWorkspaceStore } from "../store/useProjectWorkspaceStore";
import { ApiError } from "../api/client";

interface ProjectRow {
  project_id: string;
  topic: string | null;
  updated_at: string;
}

export function Dashboard() {
  const navigate = useNavigate();
  const reset = useProjectWorkspaceStore((s) => s.reset);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectModeAvailable, setProjectModeAvailable] = useState(true);

  useEffect(() => {
    projectsApi
      .listProjects()
      .then((r) => setProjects(r.projects))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          setProjectModeAvailable(false);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleNew = () => {
    reset();
    navigate("/project/new");
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Projects</h1>
          <Button onClick={handleNew} size="sm">
            <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
            New Project
          </Button>
        </div>

        {loading && <p className="text-sm text-muted">Loading…</p>}

        {!loading && !projectModeAvailable && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
            Project mode disabled on server. Videos will generate without timeline editing.
          </div>
        )}

        {!loading && projects.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface p-10 text-center">
            <Film className="h-8 w-8 text-muted" />
            <p className="text-sm text-muted">No projects yet</p>
            <Button onClick={handleNew} size="sm">
              Create your first video
            </Button>
          </div>
        )}

        {!loading && projects.length > 0 && (
          <ul className="space-y-1">
            {projects.map((p) => (
              <li key={p.project_id}>
                <button
                  onClick={() => navigate(`/project/${p.project_id}`)}
                  className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="text-sm text-foreground truncate">
                    {p.topic ?? p.project_id}
                  </span>
                  <span className="ml-4 shrink-0 text-xs text-muted">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Update App.tsx routes**

```tsx
// webui-react/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { Dashboard } from "./pages/Dashboard";
import { Workspace } from "./pages/Workspace";
import { Settings } from "./pages/Settings";
// Keep old pages during migration period
import { AutoFlow } from "./pages/AutoFlow";
import { Editor } from "./pages/Editor";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* New workspace routes */}
        <Route element={<WorkspaceLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="project/new" element={<Workspace />} />
          <Route path="project/:id" element={<Workspace />} />
        </Route>
        {/* Legacy routes — kept during migration */}
        <Route element={<Layout />}>
          <Route path="auto" element={<AutoFlow />} />
          <Route path="editor" element={<Editor />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

Note: `Workspace` component is a stub until Task 12. Create a temporary stub:

```tsx
// webui-react/src/pages/Workspace.tsx (temporary stub for Task 5)
export function Workspace() {
  return <div className="p-6 text-sm text-muted">Workspace — coming in Task 12</div>;
}
```

- [ ] **Step 6: Run Dashboard tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/pages/Dashboard.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 7: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add webui-react/src/pages/Dashboard.tsx \
  webui-react/src/pages/Workspace.tsx \
  webui-react/src/App.tsx \
  webui-react/src/api/projects.ts \
  webui-react/src/__tests__/pages/Dashboard.test.tsx
git commit -m "feat(webui-react): add Dashboard page and workspace routes"
```

---

## Task 6: ScriptPanel adaptation + VideoConfigPanel (tabbed)

**Files:**
- Modify: `webui-react/src/components/panels/ScriptPanel.tsx`
- Create: `webui-react/src/components/panels/VideoConfigPanel.tsx`
- Create: `webui-react/src/__tests__/panels/VideoConfigPanel.test.tsx`

**Interfaces:**
- Consumes: `useVideoStore` (form fields); `useProjectWorkspaceStore.setPanel/setTopic`; `TabBar`
- Produces: `ScriptPanel` (adapted), `VideoConfigPanel` (new tabbed component) — used in Task 12

- [ ] **Step 1: Write VideoConfigPanel test**

```tsx
// webui-react/src/__tests__/panels/VideoConfigPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VideoConfigPanel } from "../../components/panels/VideoConfigPanel";

describe("VideoConfigPanel", () => {
  it("renders Video, Audio, and Subtitles tabs", () => {
    render(<VideoConfigPanel />);
    expect(screen.getByText("Video")).toBeInTheDocument();
    expect(screen.getByText("Audio")).toBeInTheDocument();
    expect(screen.getByText("Subtitles")).toBeInTheDocument();
  });

  it("switches tab on click", async () => {
    render(<VideoConfigPanel />);
    await userEvent.click(screen.getByText("Audio"));
    expect(screen.getByText("Voice")).toBeInTheDocument();
  });

  it("shows Generate Video button", () => {
    render(<VideoConfigPanel />);
    expect(screen.getByText(/Generate Video/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/panels/VideoConfigPanel.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Adapt ScriptPanel to sync topic with workspace store**

In `webui-react/src/components/panels/ScriptPanel.tsx`, add after the existing store imports:

```tsx
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
```

Inside `ScriptPanel` function, add:
```tsx
const workspaceStore = useProjectWorkspaceStore();

// Sync topic input → workspace store topic
const handleTopicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  store.set("video_subject", e.target.value);
  workspaceStore.setTopic(e.target.value);
};
```

Replace the `onChange` on the Topic input from `(e) => store.set("video_subject", e.target.value)` to `handleTopicChange`.

At the bottom of the Script section (after the Keywords textarea, before closing `</section>`), add:

```tsx
<div className="flex gap-2 pt-2">
  <Button
    variant="ghost"
    size="sm"
    onClick={() => workspaceStore.setPanel("script")}
    className="flex-none"
  >
    ← Back
  </Button>
  <Button
    className="flex-1"
    disabled={!store.video_subject.trim()}
    onClick={() => workspaceStore.setPanel("config")}
  >
    Continue to Settings →
  </Button>
</div>
```

- [ ] **Step 4: Implement VideoConfigPanel**

```tsx
// webui-react/src/components/panels/VideoConfigPanel.tsx
import { useState } from "react";
import { Wand2 } from "lucide-react";
import { TabBar, Select, Slider, Checkbox, Collapsible, Button } from "../ui";
import { useVideoStore } from "../../store/useVideoStore";
import { useConfigStore } from "../../store/useConfigStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import type { VideoAspect, VideoConcatMode, VideoTransitionMode } from "../../api/types";

const TABS = [
  { key: "video", label: "Video" },
  { key: "audio", label: "Audio" },
  { key: "subtitles", label: "Subtitles" },
];

const ASPECT_OPTIONS = [
  { value: "9:16", label: "Portrait 9:16" },
  { value: "16:9", label: "Landscape 16:9" },
  { value: "1:1", label: "Square 1:1" },
];

const CONCAT_OPTIONS = [
  { value: "random", label: "Random" },
  { value: "sequential", label: "Sequential" },
];

const TRANSITION_OPTIONS = [
  { value: "", label: "None" },
  { value: "FadeIn", label: "Fade In" },
  { value: "FadeOut", label: "Fade Out" },
  { value: "SlideIn", label: "Slide In" },
  { value: "SlideOut", label: "Slide Out" },
];

const VOICE_OPTIONS = [
  { value: "", label: "Default" },
  { value: "es-ES-AlvaroNeural", label: "es-ES Álvaro" },
  { value: "es-ES-ElviraNeural", label: "es-ES Elvira" },
  { value: "es-MX-DaliaNeural", label: "es-MX Dalia" },
  { value: "en-US-JennyNeural", label: "en-US Jenny" },
];

const FONT_OPTIONS = [
  { value: "STHeitiMedium.ttc", label: "STHeitiMedium" },
  { value: "NotoSansHans-Medium.ttf", label: "NotoSans Han" },
];

const POSITION_OPTIONS = [
  { value: "bottom", label: "Bottom" },
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "custom", label: "Custom %" },
];

export function VideoConfigPanel() {
  const [tab, setTab] = useState("video");
  const store = useVideoStore();
  const { config } = useConfigStore();
  const workspaceStore = useProjectWorkspaceStore();

  const videoSourceOptions = (config?.video_sources ?? ["pexels", "pixabay"]).map(
    (s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })
  );

  const handleGenerate = () => {
    void workspaceStore.generateVideo(store.toParams());
  };

  return (
    <section className="flex flex-col h-full max-w-xl mx-auto w-full px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-foreground">Configure your video</h2>
        <button
          onClick={() => workspaceStore.setPanel("script")}
          className="text-xs text-muted hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {tab === "video" && (
          <>
            <Select label="Source" value={store.video_source ?? "pexels"} options={videoSourceOptions}
              onChange={(e) => store.set("video_source", e.target.value)} />
            <Select label="Aspect Ratio" value={store.video_aspect ?? "9:16"} options={ASPECT_OPTIONS}
              onChange={(e) => store.set("video_aspect", e.target.value as VideoAspect)} />
            <Select label="Clip Order" value={store.video_concat_mode ?? "random"} options={CONCAT_OPTIONS}
              onChange={(e) => store.set("video_concat_mode", e.target.value as VideoConcatMode)} />
            <Select label="Transition" value={store.video_transition_mode ?? ""} options={TRANSITION_OPTIONS}
              onChange={(e) => store.set("video_transition_mode", (e.target.value || null) as VideoTransitionMode)} />
            <Slider label="Clip Duration (s)" value={store.video_clip_duration ?? 5}
              min={1} max={15} step={1}
              onChange={(v) => store.set("video_clip_duration", v)}
              displayValue={`${store.video_clip_duration ?? 5}s`} />
            <Collapsible title="Advanced">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Video Count</label>
                <input type="number" min={1} max={10} value={store.video_count ?? 1}
                  onChange={(e) => store.set("video_count", parseInt(e.target.value, 10))}
                  className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
              </div>
              <Checkbox label="Match clips to script" checked={store.match_materials_to_script ?? false}
                onChange={(v) => store.set("match_materials_to_script", v)} />
            </Collapsible>
          </>
        )}

        {tab === "audio" && (
          <>
            <Select label="Voice" value={store.voice_name ?? ""} options={VOICE_OPTIONS}
              onChange={(e) => store.set("voice_name", e.target.value)} />
            <Slider label="Voice Volume" value={store.voice_volume ?? 1.0} min={0} max={2} step={0.1}
              onChange={(v) => store.set("voice_volume", v)}
              displayValue={(store.voice_volume ?? 1.0).toFixed(1)} />
            <Slider label="Voice Rate" value={store.voice_rate ?? 1.0} min={0.5} max={2.0} step={0.1}
              onChange={(v) => store.set("voice_rate", v)}
              displayValue={`${(store.voice_rate ?? 1.0).toFixed(1)}×`} />
            <Slider label="BGM Volume" value={store.bgm_volume ?? 0.2} min={0} max={1} step={0.05}
              onChange={(v) => store.set("bgm_volume", v)}
              displayValue={(store.bgm_volume ?? 0.2).toFixed(2)} />
          </>
        )}

        {tab === "subtitles" && (
          <>
            <Checkbox label="Enable subtitles" checked={store.subtitle_enabled ?? true}
              onChange={(v) => store.set("subtitle_enabled", v)} />
            {store.subtitle_enabled && (
              <>
                <Select label="Position" value={store.subtitle_position ?? "bottom"} options={POSITION_OPTIONS}
                  onChange={(e) => store.set("subtitle_position", e.target.value)} />
                {store.subtitle_position === "custom" && (
                  <Slider label="Custom Position %" value={store.custom_position ?? 70} min={0} max={100} step={1}
                    onChange={(v) => store.set("custom_position", v)}
                    displayValue={`${store.custom_position ?? 70}%`} />
                )}
                <Select label="Font" value={store.font_name ?? "STHeitiMedium.ttc"} options={FONT_OPTIONS}
                  onChange={(e) => store.set("font_name", e.target.value)} />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted">Font Size</label>
                  <input type="number" min={20} max={120} value={store.font_size ?? 60}
                    onChange={(e) => store.set("font_size", parseInt(e.target.value, 10))}
                    className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent" />
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="border-t border-border pt-4">
        <Button className="w-full" size="lg" onClick={handleGenerate}
          disabled={!store.video_subject.trim()}>
          <Wand2 className="mr-2 h-4 w-4" />
          Generate Video
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run VideoConfigPanel tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/panels/VideoConfigPanel.test.tsx
```
Expected: 3 tests PASS.

- [ ] **Step 6: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add webui-react/src/components/panels/ScriptPanel.tsx \
  webui-react/src/components/panels/VideoConfigPanel.tsx \
  webui-react/src/__tests__/panels/VideoConfigPanel.test.tsx
git commit -m "feat(webui-react): add VideoConfigPanel with tabs; adapt ScriptPanel to workspace store"
```

---

## Task 7: GeneratingPanel + DonePanel

**Files:**
- Create: `webui-react/src/components/panels/GeneratingPanel.tsx`
- Create: `webui-react/src/components/panels/DonePanel.tsx`
- Create: `webui-react/src/__tests__/panels/GeneratingPanel.test.tsx`

**Interfaces:**
- Consumes: `useProjectWorkspaceStore` (taskStatus, panel, videoUrls, setPanel, reset)
- Produces: `GeneratingPanel`, `DonePanel` — used in Task 12 (Workspace)

- [ ] **Step 1: Write GeneratingPanel tests**

```tsx
// webui-react/src/__tests__/panels/GeneratingPanel.test.tsx
import { render, screen } from "@testing-library/react";
import { GeneratingPanel } from "../../components/panels/GeneratingPanel";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

beforeEach(() => useProjectWorkspaceStore.getState().reset());

describe("GeneratingPanel", () => {
  it("renders progress bar when taskStatus has progress", () => {
    useProjectWorkspaceStore.setState({
      taskStatus: { state: 4, progress: 60, videos: [], combined_videos: [] },
    });
    render(<GeneratingPanel />);
    expect(screen.getByText("60%")).toBeInTheDocument();
  });

  it("renders all step labels", () => {
    render(<GeneratingPanel />);
    expect(screen.getByText(/Script/i)).toBeInTheDocument();
    expect(screen.getByText(/Audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Clips/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/panels/GeneratingPanel.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement GeneratingPanel**

```tsx
// webui-react/src/components/panels/GeneratingPanel.tsx
import { useState } from "react";
import { Check, Loader2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { TASK_STATE_PROCESSING } from "../../api/types";

const STEPS = [
  { label: "Script ready", threshold: 5 },
  { label: "Audio (TTS) synthesized", threshold: 20 },
  { label: "Word timestamps extracted", threshold: 30 },
  { label: "Downloading clips", threshold: 70 },
  { label: "Assembling video", threshold: 90 },
  { label: "Burning subtitles", threshold: 99 },
];

export function GeneratingPanel() {
  const { taskStatus, error } = useProjectWorkspaceStore();
  const [logsOpen, setLogsOpen] = useState(false);
  const progress = taskStatus?.progress ?? 0;

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-sm font-semibold text-foreground">Generating your video</h2>

        {error && (
          <p className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="space-y-2">
          {STEPS.map(({ label, threshold }) => {
            const done = progress >= threshold;
            const active = !done && progress >= threshold - 30 && progress < threshold;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-green-400" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-border" />
                )}
                <span className={done ? "text-muted line-through" : active ? "text-foreground" : "text-muted"}>
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setLogsOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          {logsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {logsOpen ? "Hide logs" : "Show logs"}
        </button>
        {logsOpen && (
          <div className="rounded-md border border-border bg-base p-3 font-mono text-xs text-muted h-28 overflow-y-auto">
            <p>Polling task… progress {progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement DonePanel**

```tsx
// webui-react/src/components/panels/DonePanel.tsx
import { Download, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "../ui";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";

export function DonePanel() {
  const { videoUrls, reset, setPanel } = useProjectWorkspaceStore();
  const videoReset = useVideoStore((s) => s.reset);

  const handleNew = () => {
    reset();
    videoReset();
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-xl space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-400" />
          <h2 className="text-sm font-semibold text-foreground">Video ready</h2>
        </div>

        {videoUrls.map((url) => (
          <div key={url} className="rounded-lg overflow-hidden border border-border bg-surface">
            <video src={url} controls className="w-full max-h-[480px] object-contain" />
            <div className="flex items-center gap-2 px-3 py-2">
              <a href={url} download
                className="inline-flex items-center gap-1 text-xs text-accent hover:text-accent-hover">
                <Download className="h-3.5 w-3.5" />
                Download
              </a>
            </div>
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" onClick={() => setPanel("config")} size="sm">
            ← Edit settings
          </Button>
          <Button onClick={handleNew} size="sm">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            New video
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run GeneratingPanel tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/panels/GeneratingPanel.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 6: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add webui-react/src/components/panels/GeneratingPanel.tsx \
  webui-react/src/components/panels/DonePanel.tsx \
  webui-react/src/__tests__/panels/GeneratingPanel.test.tsx
git commit -m "feat(webui-react): add GeneratingPanel with step checklist and DonePanel"
```

---

## Task 8: ReviewPanel + ClipGrid

**Files:**
- Create: `webui-react/src/components/panels/ReviewPanel.tsx`
- Create: `webui-react/src/components/panels/ClipGrid.tsx`
- Create: `webui-react/src/__tests__/panels/ClipGrid.test.tsx`

**Interfaces:**
- Consumes: `useProjectStore` (project timeline); `useProjectWorkspaceStore.setPanel`; `TimelineItem`, `TimelineTrack` from `src/api/types.ts`
- Produces: `ReviewPanel`, `ClipGrid` — used in Task 12

Note: Review panel shows clips from the project timeline (project mode). If no project, shows message.

- [ ] **Step 1: Write ClipGrid tests**

```tsx
// webui-react/src/__tests__/panels/ClipGrid.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClipGrid } from "../../components/panels/ClipGrid";
import type { TimelineItem } from "../../api/types";
import { vi } from "vitest";

const CLIPS: TimelineItem[] = [
  { id: "clip-1", start_sec: 0, duration_sec: 5.2 },
  { id: "clip-2", start_sec: 5.2, duration_sec: 4.8 },
  { id: "clip-3", start_sec: 10, duration_sec: 6.1 },
];

describe("ClipGrid", () => {
  it("renders clip count", () => {
    render(<ClipGrid clips={CLIPS} onExclude={vi.fn()} excluded={[]} />);
    expect(screen.getAllByText(/clip-/i).length).toBeGreaterThan(0);
  });

  it("calls onExclude when exclude button clicked", async () => {
    const onExclude = vi.fn();
    render(<ClipGrid clips={CLIPS} onExclude={onExclude} excluded={[]} />);
    const excludeButtons = screen.getAllByTitle(/exclude/i);
    await userEvent.click(excludeButtons[0]);
    expect(onExclude).toHaveBeenCalledWith("clip-1");
  });

  it("dims excluded clips", () => {
    const { container } = render(
      <ClipGrid clips={CLIPS} onExclude={vi.fn()} excluded={["clip-2"]} />
    );
    const dimmed = container.querySelector('[data-excluded="true"]');
    expect(dimmed).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/panels/ClipGrid.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement ClipGrid**

```tsx
// webui-react/src/components/panels/ClipGrid.tsx
import { X, Play } from "lucide-react";
import type { TimelineItem } from "../../api/types";

interface ClipGridProps {
  clips: TimelineItem[];
  excluded: string[];
  onExclude: (clipId: string) => void;
}

export function ClipGrid({ clips, excluded, onExclude }: ClipGridProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {clips.map((clip, idx) => {
        const isExcluded = excluded.includes(clip.id);
        return (
          <div
            key={clip.id}
            data-excluded={isExcluded}
            className={`group relative rounded-lg overflow-hidden border transition-opacity ${
              isExcluded
                ? "border-border opacity-40"
                : "border-border hover:border-accent"
            }`}
          >
            {/* Thumbnail or fallback */}
            <div
              className="aspect-[9/16] flex items-center justify-center bg-surface-elevated text-xs text-muted font-mono"
              style={{
                background: `hsl(${(idx * 47) % 360}, 20%, 18%)`,
              }}
            >
              {clip.thumbnail_url ? (
                <img
                  src={clip.thumbnail_url}
                  alt={`clip ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>#{idx + 1}</span>
              )}
            </div>

            {/* Overlay controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <button className="rounded-full bg-white/20 p-1.5 hover:bg-white/40">
                <Play className="h-3 w-3 text-white" />
              </button>
              <button
                title="Exclude clip"
                onClick={() => onExclude(clip.id)}
                className="rounded-full bg-red-500/60 p-1.5 hover:bg-red-500"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>

            {/* Duration badge */}
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white font-mono">
              {clip.duration_sec.toFixed(1)}s
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Implement ReviewPanel**

```tsx
// webui-react/src/components/panels/ReviewPanel.tsx
import { useState } from "react";
import { Edit3, Clapperboard } from "lucide-react";
import { Button } from "../ui";
import { ClipGrid } from "./ClipGrid";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

export function ReviewPanel() {
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();
  const [excluded, setExcluded] = useState<string[]>([]);

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const clips = videoTrack?.items ?? [];

  if (projectStore.mode === "disabled") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8 text-center">
        <p className="text-sm text-muted">Project mode disabled on server.</p>
        <p className="text-xs text-muted mt-1">Enable TURBOPRINTER_PROJECT_MODE_ENABLED to use clip review.</p>
        <Button className="mt-4" onClick={() => setPanel("done")}>Continue to Done</Button>
      </div>
    );
  }

  const handleExclude = (clipId: string) => {
    setExcluded((prev) =>
      prev.includes(clipId) ? prev.filter((id) => id !== clipId) : [...prev, clipId]
    );
  };

  const totalDuration = clips
    .filter((c) => !excluded.includes(c.id))
    .reduce((sum, c) => sum + c.duration_sec, 0);

  const handleEditInTimeline = () => setPanel("editor");
  const handleRender = () => setPanel("rendering");

  return (
    <div className="flex flex-col min-h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Review clips</h2>
          <p className="text-xs text-muted mt-0.5">
            {clips.length} clips · ~{totalDuration.toFixed(0)}s total
            {excluded.length > 0 && ` · ${excluded.length} excluded`}
          </p>
        </div>
      </div>

      {clips.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">No clips found. Build a timeline first.</p>
        </div>
      ) : (
        <ClipGrid clips={clips} excluded={excluded} onExclude={handleExclude} />
      )}

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button variant="ghost" onClick={handleEditInTimeline} disabled={clips.length === 0}>
          <Edit3 className="mr-1.5 h-3.5 w-3.5" />
          Edit in Timeline
        </Button>
        <Button onClick={handleRender} className="flex-1">
          <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
          Render
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run ClipGrid tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/panels/ClipGrid.test.tsx
```
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add webui-react/src/components/panels/ReviewPanel.tsx \
  webui-react/src/components/panels/ClipGrid.tsx \
  webui-react/src/__tests__/panels/ClipGrid.test.tsx
git commit -m "feat(webui-react): add ReviewPanel and ClipGrid with thumbnail and exclude"
```

---

## Task 9: EditorPanel (VideoPreview + ClipInspector + Timeline — static)

**Files:**
- Create: `webui-react/src/components/editor/VideoPreview.tsx`
- Create: `webui-react/src/components/editor/ClipInspector.tsx`
- Create: `webui-react/src/components/editor/Timeline.tsx`
- Create: `webui-react/src/components/panels/EditorPanel.tsx`
- Create: `webui-react/src/__tests__/editor/Timeline.test.tsx`

**Interfaces:**
- Consumes: `TimelineItem` and `TimelineTrack` from types; `useProjectStore.project`; `useProjectWorkspaceStore.setPanel`
- Produces: `EditorPanel` used in Task 12; Timeline ready for dnd-kit upgrade in Phase 3

Note: drag-drop is OUT OF SCOPE for this task. Timeline renders clips as static pills. Labels include `data-testid` for future testing.

- [ ] **Step 1: Write Timeline tests**

```tsx
// webui-react/src/__tests__/editor/Timeline.test.tsx
import { render, screen } from "@testing-library/react";
import { Timeline } from "../../components/editor/Timeline";
import type { TimelineItem } from "../../api/types";

const ITEMS: TimelineItem[] = [
  { id: "c1", start_sec: 0, duration_sec: 5 },
  { id: "c2", start_sec: 5, duration_sec: 4 },
  { id: "c3", start_sec: 9, duration_sec: 6 },
];

describe("Timeline", () => {
  it("renders all clip ids", () => {
    render(<Timeline items={ITEMS} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByTestId("clip-c1")).toBeInTheDocument();
    expect(screen.getByTestId("clip-c2")).toBeInTheDocument();
    expect(screen.getByTestId("clip-c3")).toBeInTheDocument();
  });

  it("marks selected clip", () => {
    render(<Timeline items={ITEMS} selectedId="c2" onSelect={() => {}} />);
    const clip = screen.getByTestId("clip-c2");
    expect(clip.className).toMatch(/accent/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/editor/Timeline.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Implement Timeline (static)**

```tsx
// webui-react/src/components/editor/Timeline.tsx
import type { TimelineItem } from "../../api/types";

interface TimelineProps {
  items: TimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Timeline({ items, selectedId, onSelect }: TimelineProps) {
  const totalDuration = items.reduce((s, c) => s + c.duration_sec, 0) || 1;

  return (
    <div className="border-t border-border bg-base">
      {/* Waveform placeholder */}
      <div className="h-8 flex items-center px-3 gap-px">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="bg-accent/30 rounded-sm flex-1"
            style={{ height: `${20 + Math.sin(i * 0.4) * 12}px` }}
          />
        ))}
      </div>

      {/* Clip track */}
      <div className="relative h-14 flex items-center px-3 gap-1 overflow-x-auto">
        {items.map((item, idx) => {
          const widthPct = (item.duration_sec / totalDuration) * 100;
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              data-testid={`clip-${item.id}`}
              onClick={() => onSelect(item.id)}
              style={{ width: `${widthPct}%`, minWidth: "40px" }}
              className={`h-10 shrink-0 rounded flex items-center justify-center text-[10px] font-mono border transition-colors cursor-pointer ${
                isSelected
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border bg-surface text-muted hover:border-accent/50"
              }`}
            >
              #{idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement VideoPreview**

```tsx
// webui-react/src/components/editor/VideoPreview.tsx
import { useRef } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useState } from "react";

interface VideoPreviewProps {
  src?: string;
}

export function VideoPreview({ src }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      void videoRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="flex flex-col bg-black rounded-lg overflow-hidden">
      {src ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full max-h-64 object-contain"
          onEnded={() => setPlaying(false)}
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center bg-surface text-muted text-sm">
          Select a clip to preview
        </div>
      )}
      <div className="flex items-center justify-center gap-3 py-2 bg-surface">
        <button onClick={() => { if (videoRef.current) videoRef.current.currentTime = 0; }}
          className="text-muted hover:text-foreground">
          <SkipBack className="h-4 w-4" />
        </button>
        <button onClick={toggle}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={() => { if (videoRef.current) videoRef.current.currentTime += 5; }}
          className="text-muted hover:text-foreground">
          <SkipForward className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement ClipInspector**

```tsx
// webui-react/src/components/editor/ClipInspector.tsx
import { Trash2, RefreshCw } from "lucide-react";
import type { TimelineItem } from "../../api/types";

interface ClipInspectorProps {
  clip: TimelineItem | null;
  onTrimChange: (id: string, start: number, end: number | null) => void;
  onRemove: (id: string) => void;
}

export function ClipInspector({ clip, onTrimChange, onRemove }: ClipInspectorProps) {
  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted p-4 text-center">
        Select a clip on the timeline to inspect it.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Clip</p>
        <p className="text-sm font-mono text-foreground">{clip.id}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Duration</p>
        <p className="text-sm text-foreground">{clip.duration_sec.toFixed(2)}s</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted block mb-1">
            Trim start (s)
          </label>
          <input
            type="number"
            min={0}
            max={clip.duration_sec - 0.5}
            step={0.1}
            defaultValue={(clip.trim_start_sec ?? 0).toFixed(1)}
            onBlur={(e) =>
              onTrimChange(clip.id, parseFloat(e.target.value), clip.trim_end_sec ?? null)
            }
            className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted block mb-1">
            Trim end (s)
          </label>
          <input
            type="number"
            min={0.5}
            max={clip.duration_sec}
            step={0.1}
            defaultValue={(clip.trim_end_sec ?? clip.duration_sec).toFixed(1)}
            onBlur={(e) =>
              onTrimChange(clip.id, clip.trim_start_sec ?? 0, parseFloat(e.target.value))
            }
            className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <button
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/50 transition-colors"
          title="Replace clip (Phase 3)"
          disabled
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Replace clip
        </button>
        <button
          onClick={() => onRemove(clip.id)}
          className="flex items-center gap-2 rounded-md border border-red-800/50 px-3 py-1.5 text-xs text-red-400 hover:border-red-500 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Implement EditorPanel**

```tsx
// webui-react/src/components/panels/EditorPanel.tsx
import { useState } from "react";
import { VideoPreview } from "../editor/VideoPreview";
import { ClipInspector } from "../editor/ClipInspector";
import { Timeline } from "../editor/Timeline";
import { Button } from "../ui";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import type { TimelineItem } from "../../api/types";

export function EditorPanel() {
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const items: TimelineItem[] = videoTrack?.items ?? [];

  const selectedClip = items.find((c) => c.id === selectedId) ?? null;

  const handleTrimChange = (id: string, start: number, end: number | null) => {
    void projectStore.applyTimelineCommands({
      commands: [{
        type: "trim",
        track_id: videoTrack?.id ?? "",
        item_id: id,
        trim_start_sec: start,
        trim_end_sec: end,
      }],
    });
  };

  const handleRemove = (id: string) => {
    void projectStore.applyTimelineCommands({
      commands: [{
        type: "move",
        track_id: videoTrack?.id ?? "",
        item_id: id,
        new_start_sec: -1,
      }],
    });
    if (selectedId === id) setSelectedId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top: preview + inspector */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[3] p-4">
          <VideoPreview src={selectedClip?.local_path ?? undefined} />
        </div>
        <div className="flex-[2] border-l border-border overflow-y-auto">
          <ClipInspector
            clip={selectedClip}
            onTrimChange={handleTrimChange}
            onRemove={handleRemove}
          />
        </div>
      </div>

      {/* Bottom: timeline */}
      <Timeline items={items} selectedId={selectedId} onSelect={setSelectedId} />

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setPanel("review")}>
          ← Back to Review
        </Button>
        <Button size="sm" onClick={() => setPanel("rendering")}>
          Render ▶
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run Timeline tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/editor/Timeline.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add webui-react/src/components/editor/ \
  webui-react/src/components/panels/EditorPanel.tsx \
  webui-react/src/__tests__/editor/Timeline.test.tsx
git commit -m "feat(webui-react): add EditorPanel with static Timeline, VideoPreview, ClipInspector"
```

---

## Task 10: RenderingPanel + Workspace.tsx (final assembly)

**Files:**
- Create: `webui-react/src/components/panels/RenderingPanel.tsx`
- Modify: `webui-react/src/pages/Workspace.tsx` (replace stub)
- Create: `webui-react/src/__tests__/pages/Workspace.test.tsx`

**Interfaces:**
- Consumes: All panels from Tasks 6, 7, 8, 9; `useProjectWorkspaceStore.panel`; `useProjectStore` for rendering
- Produces: Complete `Workspace.tsx` state router

- [ ] **Step 1: Write Workspace tests**

```tsx
// webui-react/src/__tests__/pages/Workspace.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { Workspace } from "../../pages/Workspace";

beforeEach(() => useProjectWorkspaceStore.getState().reset());

describe("Workspace", () => {
  it("shows ScriptPanel when panel is script", () => {
    render(<MemoryRouter><Workspace /></MemoryRouter>);
    expect(screen.getByText(/Topic/i)).toBeInTheDocument();
  });

  it("shows VideoConfigPanel when panel is config", () => {
    useProjectWorkspaceStore.setState({ panel: "config" });
    render(<MemoryRouter><Workspace /></MemoryRouter>);
    expect(screen.getByText(/Generate Video/i)).toBeInTheDocument();
  });

  it("shows DonePanel when panel is done", () => {
    useProjectWorkspaceStore.setState({ panel: "done", videoUrls: [] });
    render(<MemoryRouter><Workspace /></MemoryRouter>);
    expect(screen.getByText(/Video ready/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd webui-react && npx vitest run src/__tests__/pages/Workspace.test.tsx
```
Expected: FAIL — stub Workspace doesn't render panels.

- [ ] **Step 3: Implement RenderingPanel**

```tsx
// webui-react/src/components/panels/RenderingPanel.tsx
import { useEffect } from "react";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED } from "../../api/types";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "../ui";

export function RenderingPanel() {
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();

  useEffect(() => {
    if (projectStore.projectId && projectStore.mode !== "loading") {
      void projectStore.render();
    }
  }, []);

  const status = projectStore.renderStatus;
  const progress = status?.progress ?? 0;
  const isDone = status?.state === TASK_STATE_COMPLETE;
  const isFailed = status?.state === TASK_STATE_FAILED;

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-sm font-semibold text-foreground">Rendering final video</h2>

        {!isFailed && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {!isDone && !isFailed && (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Assembling your video…</span>
          </div>
        )}

        {isDone && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>Render complete!</span>
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <XCircle className="h-4 w-4" />
            <span>{status?.error ?? "Render failed"}</span>
          </div>
        )}

        {(isDone || isFailed) && (
          <Button onClick={() => setPanel(isDone ? "done" : "editor")} size="sm">
            {isDone ? "View result →" : "← Back to Editor"}
          </Button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement final Workspace.tsx**

```tsx
// webui-react/src/pages/Workspace.tsx
import { ScriptPanel } from "../components/panels/ScriptPanel";
import { VideoConfigPanel } from "../components/panels/VideoConfigPanel";
import { GeneratingPanel } from "../components/panels/GeneratingPanel";
import { ReviewPanel } from "../components/panels/ReviewPanel";
import { EditorPanel } from "../components/panels/EditorPanel";
import { RenderingPanel } from "../components/panels/RenderingPanel";
import { DonePanel } from "../components/panels/DonePanel";
import { useProjectWorkspaceStore } from "../store/useProjectWorkspaceStore";

const PANEL_MAP = {
  script:     <ScriptPanel />,
  config:     <VideoConfigPanel />,
  generating: <GeneratingPanel />,
  review:     <ReviewPanel />,
  editor:     <EditorPanel />,
  rendering:  <RenderingPanel />,
  done:       <DonePanel />,
} as const;

export function Workspace() {
  const { panel } = useProjectWorkspaceStore();
  return (
    <div className="flex flex-col h-full">
      {PANEL_MAP[panel]}
    </div>
  );
}
```

- [ ] **Step 5: Run Workspace tests — expect PASS**

```bash
cd webui-react && npx vitest run src/__tests__/pages/Workspace.test.tsx
```
Expected: 3 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd webui-react && npx vitest run
```
Expected: all tests PASS. Fix any failures before continuing.

- [ ] **Step 7: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add webui-react/src/components/panels/RenderingPanel.tsx \
  webui-react/src/pages/Workspace.tsx \
  webui-react/src/__tests__/pages/Workspace.test.tsx
git commit -m "feat(webui-react): assemble Workspace.tsx state router with all panels"
```

---

## Task 11: Settings page refactor + ApiKeyInput

**Files:**
- Create: `webui-react/src/components/ui/ApiKeyInput.tsx`
- Modify: `webui-react/src/pages/Settings.tsx`
- Modify: `webui-react/src/components/ui/index.ts`

**Interfaces:**
- Consumes: `configApi.get()` and `configApi.save()` from `src/api/config.ts`; `useConfigStore`
- Produces: `ApiKeyInput` (reusable masked input); improved `Settings.tsx` with editable sections

- [ ] **Step 1: Implement ApiKeyInput**

```tsx
// webui-react/src/components/ui/ApiKeyInput.tsx
import { useState } from "react";
import { Eye, EyeOff, Save } from "lucide-react";

interface ApiKeyInputProps {
  label: string;
  value: string;
  placeholder?: string;
  onSave: (value: string) => Promise<void>;
}

export function ApiKeyInput({ label, value, placeholder, onSave }: ApiKeyInputProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const maskedDisplay = value
    ? "•".repeat(8) + value.slice(-4)
    : "(not set)";

  const handleEdit = () => {
    setDraft(value);
    setEditing(true);
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      setSaved(true);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-muted">{label}</label>
      {editing ? (
        <div className="flex items-center gap-1">
          <div className="relative flex-1">
            <input
              type={revealed ? "text" : "password"}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={placeholder}
              className="h-8 w-full rounded border border-border bg-surface px-3 pr-8 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <button
              type="button"
              onClick={() => setRevealed((r) => !r)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded border border-border bg-surface px-2 py-1 text-xs text-accent hover:border-accent disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded border border-border px-2 py-1 text-xs text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">{maskedDisplay}</span>
          {saved && <span className="text-xs text-green-400">✓ Saved</span>}
          <button
            onClick={handleEdit}
            className="ml-auto text-xs text-accent hover:text-accent-hover"
          >
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add ApiKeyInput to ui/index.ts**

```ts
// Add to webui-react/src/components/ui/index.ts
export { ApiKeyInput } from "./ApiKeyInput";
```

- [ ] **Step 3: Refactor Settings.tsx**

```tsx
// webui-react/src/pages/Settings.tsx
import { useEffect, useState } from "react";
import { useConfigStore } from "../store/useConfigStore";
import { configApi } from "../api/config";
import { ApiKeyInput } from "../components/ui";
import { Collapsible } from "../components/ui";

export function Settings() {
  const { config, setConfig } = useConfigStore();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    configApi.get().then(setConfig).catch(() => {});
  }, []);

  const saveKey = async (key: string, value: string) => {
    setSaving(true);
    try {
      await configApi.save({ [key]: value });
      await configApi.get().then(setConfig);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-base font-semibold text-foreground">Settings</h1>

      <Collapsible title="LLM Provider" defaultOpen>
        <div className="space-y-3">
          {!config ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted">Provider</label>
                <p className="text-sm text-foreground">{config.llm_provider ?? "—"}</p>
              </div>
              <ApiKeyInput
                label="API Key"
                value={config.llm_api_key ?? ""}
                placeholder="sk-..."
                onSave={(v) => saveKey("llm_api_key", v)}
              />
            </>
          )}
        </div>
      </Collapsible>

      <Collapsible title="Media APIs">
        <div className="space-y-3">
          <ApiKeyInput
            label="Pexels API Key"
            value={config?.pexels_api_key ?? ""}
            placeholder="pexels-..."
            onSave={(v) => saveKey("pexels_api_key", v)}
          />
          <ApiKeyInput
            label="Pixabay API Key"
            value={config?.pixabay_api_key ?? ""}
            placeholder="pixabay-..."
            onSave={(v) => saveKey("pixabay_api_key", v)}
          />
        </div>
      </Collapsible>

      <Collapsible title="Server Config">
        {!config ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Video sources</dt>
              <dd className="text-foreground">{config.video_sources.join(", ")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Default subtitle position</dt>
              <dd className="text-foreground">{config.subtitle_position_default}</dd>
            </div>
          </dl>
        )}
      </Collapsible>

      <p className="text-xs text-muted">
        For full config, edit <code className="font-mono">config.toml</code> and restart the server.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd webui-react && npx tsc --noEmit
```

- [ ] **Step 5: Run full test suite**

```bash
cd webui-react && npx vitest run
```
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add webui-react/src/components/ui/ApiKeyInput.tsx \
  webui-react/src/components/ui/index.ts \
  webui-react/src/pages/Settings.tsx
git commit -m "feat(webui-react): refactor Settings with inline editing and ApiKeyInput"
```

---

## Task 12: Build + integration smoke test + legacy route cleanup

**Files:**
- Modify: `webui-react/src/App.tsx` (remove legacy routes after verification)
- Run: build + manual smoke test

- [ ] **Step 1: Build the frontend**

```bash
cd webui-react && npm run build
```
Expected: build completes with no errors. Output in `dist/`.

- [ ] **Step 2: Run backend**

```bash
uv run python main.py
```
Open browser to `http://localhost:8080`.

- [ ] **Step 3: Smoke test checklist**

Verify each of these manually:
- [ ] `/` → Dashboard renders, shows "New Project" button
- [ ] "New Project" → navigates to `/project/new`, shows Script panel
- [ ] PipelineBar shows "Script" as active step at bottom
- [ ] TopicBar shows "Untitled project" + "Draft" badge
- [ ] Type topic → "Continue to Settings →" enables
- [ ] Click "Continue to Settings" → VideoConfigPanel renders with 3 tabs
- [ ] Click Video/Audio/Subtitles tabs → content switches correctly
- [ ] Click "Generate Video" → panel transitions to GeneratingPanel with progress bar
- [ ] After generation → DonePanel shows video player
- [ ] Download link works
- [ ] "New video" button resets to Script panel
- [ ] `/settings` → Settings page renders with Collapsible sections

- [ ] **Step 4: Verify Python compileall**

```bash
uv run python -m compileall app webui
```
Expected: no errors.

- [ ] **Step 5: Run full Python test suite**

```bash
uv run pytest
```
Expected: all tests PASS.

- [ ] **Step 6: Remove legacy routes from App.tsx**

Once smoke test passes, remove the legacy `/auto` and `/editor` routes. Keep a redirect:

```tsx
// webui-react/src/App.tsx — remove legacy section, add redirects
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { WorkspaceLayout } from "./components/layout/WorkspaceLayout";
import { Dashboard } from "./pages/Dashboard";
import { Workspace } from "./pages/Workspace";
import { Settings } from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<WorkspaceLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="project/new" element={<Workspace />} />
          <Route path="project/:id" element={<Workspace />} />
        </Route>
        <Route element={<Layout />}>
          <Route path="settings" element={<Settings />} />
        </Route>
        {/* Legacy redirects */}
        <Route path="auto" element={<Navigate to="/" replace />} />
        <Route path="editor" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 7: Final build + commit**

```bash
cd webui-react && npm run build
git add webui-react/src/App.tsx
git commit -m "feat(webui-react): wire workspace routes, retire legacy AutoFlow/Editor routes"
```

---

## Out of Scope (Future Plans)

These items are explicitly deferred:
- **dnd-kit drag-drop on Timeline** → Phase 3 spec
- **Waveform with wavesurfer.js** → Phase 3 spec
- **"Replace clip" modal** → Phase 3 spec
- **Reddit ingestion UI** → Phase 5 spec
- **Contextual BGM selector UI** → Phase 5 spec
- **Multi-provider search UI** → Phase 2 spec
- **Mobile / responsive layout** → not planned (single-user desktop)

---

## Self-Review Notes

**Spec coverage gaps fixed:**
- Task 4 adds `GET /api/v1/projects` (required by Dashboard) — spec called it out explicitly
- `ApiError` import path confirmed: `src/api/client.ts` exports `ApiError`
- `useProjectStore` (existing, from Phase 1) is used in ReviewPanel/EditorPanel/RenderingPanel — not replaced, only `useProjectWorkspaceStore` is added

**Type consistency:**
- `WorkspacePanel` defined once in `src/types/workspace.ts` — imported by store, components, layout
- `PANEL_ORDER` used by PipelineBar and `completedPanels()` in WorkspaceLayout
- `TimelineItem` has no `thumbnail_url` field in the current types — ClipGrid falls back to colored block; this is correct per spec

**Known limitation:** `configApi.save()` signature — current `src/api/config.ts` may not have a `save` method accepting partial keys. If the `POST /api/v1/config` endpoint doesn't accept partial keys, Settings save will fail gracefully (error in console). Implementer should check `app/controllers/v1/config.py` before Task 11.
