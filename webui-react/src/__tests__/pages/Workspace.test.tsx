// webui-react/src/__tests__/pages/Workspace.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import { usePublicationsStore } from "../../store/usePublicationsStore";
import { Workspace } from "../../pages/Workspace";
import { projectsApi } from "../../api/projects";
import { videoApi } from "../../api/video";
import { pollTask } from "../../api/polling";
import type { Publication } from "../../api/types";

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

const stalePublication: Publication = {
  id: "pub-stale",
  video_output_id: "vo-stale",
  project_id: "project-1",
  workspace_id: null,
  platform: "youtube",
  channel_id: null,
  external_video_id: "dry-run:pub-stale",
  title: "Stale Project Publication",
  description: "Desc",
  tags: [],
  thumbnail_path: null,
  privacy_status: "private",
  scheduled_at: null,
  published_at: null,
  status: "draft",
  error: null,
  dry_run: true,
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const projectPublication: Publication = {
  ...stalePublication,
  id: "pub-current",
  video_output_id: "vo-current",
  project_id: "project-2",
  external_video_id: null,
  title: "Persisted Project Draft",
};

beforeEach(() => {
  useProjectWorkspaceStore.getState().reset();
  useProjectStore.getState().reset();
  vi.mocked(videoApi.getTask).mockRejectedValue(new Error("task not in memory"));
  vi.mocked(videoApi.getBgmList).mockResolvedValue({ files: [] });
  vi.mocked(pollTask).mockReturnValue(new Promise(() => {}));
  usePublicationsStore.setState({
    publications: [],
    current: null,
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    load: vi.fn().mockResolvedValue(undefined),
    createDraft: vi.fn(),
    publishDryRun: vi.fn(),
  });
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

  it("opens PublicationPanel from DonePanel publish button", async () => {
    const user = userEvent.setup();
    useProjectWorkspaceStore.setState({ panel: "done", videoUrls: [] });

    render(<MemoryRouter><Workspace /></MemoryRouter>);

    await user.click(screen.getByRole("button", { name: /publicar|publish/i }));

    expect(screen.getByText(/Publicación/i)).toBeInTheDocument();
  });

  it("does not show or enable a stale current publication from another project", () => {
    useProjectStore.setState({ projectId: "project-2" });
    useProjectWorkspaceStore.setState({ panel: "publication" });
    usePublicationsStore.setState({ current: stalePublication });

    render(<MemoryRouter><Workspace /></MemoryRouter>);

    expect(screen.queryByText("Stale Project Publication")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dry-run publish/i })).toBeDisabled();
  });

  it("refreshes and selects persisted publication drafts for the open project", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ projectId: "project-2" });
    useProjectWorkspaceStore.setState({ panel: "publication" });
    usePublicationsStore.setState({
      current: null,
      publications: [stalePublication, projectPublication],
      refresh,
    });

    render(<MemoryRouter><Workspace /></MemoryRouter>);

    await waitFor(() => expect(refresh).toHaveBeenCalledWith({ project_id: "project-2" }));
    expect(screen.getByText("Persisted Project Draft")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dry-run publish/i })).toBeEnabled();
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
