// webui-react/src/__tests__/pages/Workspace.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { Workspace } from "../../pages/Workspace";
import { projectsApi } from "../../api/projects";
import { videoApi } from "../../api/video";
import { pollTask } from "../../api/polling";

vi.mock("../../api/projects", () => ({
  projectsApi: {
    getProject: vi.fn(),
  },
}));

vi.mock("../../api/video", () => ({
  videoApi: {
    getTask: vi.fn(),
    getBgmList: vi.fn(),
  },
}));

vi.mock("../../api/polling", () => ({
  pollTask: vi.fn(),
}));

beforeEach(() => {
  useProjectWorkspaceStore.getState().reset();
  vi.mocked(videoApi.getTask).mockRejectedValue(new Error("task not in memory"));
  vi.mocked(videoApi.getBgmList).mockResolvedValue({ files: [] });
  vi.mocked(pollTask).mockReturnValue(new Promise(() => {}));
});

describe("Workspace", () => {
  it("shows ScriptPanel when panel is script", () => {
    render(<MemoryRouter><Workspace /></MemoryRouter>);
    expect(screen.getByText(/Tema/i)).toBeInTheDocument();
  });

  it("shows VideoConfigPanel when panel is config", () => {
    useProjectWorkspaceStore.setState({ panel: "config" });
    render(<MemoryRouter><Workspace /></MemoryRouter>);
    expect(screen.getByText(/Generar video/i)).toBeInTheDocument();
  });

  it("shows DonePanel when panel is done", () => {
    useProjectWorkspaceStore.setState({ panel: "done", videoUrls: [] });
    render(<MemoryRouter><Workspace /></MemoryRouter>);
    expect(screen.getByText(/Video listo/i)).toBeInTheDocument();
  });

  it("clears the session taskId when opening a project by id", async () => {
    (projectsApi.getProject as any).mockResolvedValue({
      project_id: "p1",
      has_script: false,
      has_shot_plan: false,
      has_timeline: false,
      videos: [],
      combined_videos: [],
    });
    useProjectWorkspaceStore.setState({ taskId: "stale-task", taskStatus: null });

    render(
      <MemoryRouter initialEntries={["/project/p1"]}>
        <Routes>
          <Route path="/project/:id" element={<Workspace />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(useProjectWorkspaceStore.getState().taskId).toBeNull()
    );
  });

  it("keeps an active task in generation when only an intermediate video exists", async () => {
    (projectsApi.getProject as any).mockResolvedValue({
      project_id: "p-active",
      has_script: true,
      has_shot_plan: false,
      has_timeline: false,
      script: "Guion activo",
      videos: [],
      combined_videos: ["/combined-1.mp4"],
    });
    vi.mocked(videoApi.getTask).mockResolvedValue({
      state: 4,
      progress: 75,
      videos: [],
      combined_videos: ["/combined-1.mp4"],
    });

    render(
      <MemoryRouter initialEntries={["/project/p-active"]}>
        <Routes>
          <Route path="/project/:id" element={<Workspace />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText(/Generando tu video/i);
    expect(screen.queryByText(/Revisar video final/i)).not.toBeInTheDocument();
  });
});
