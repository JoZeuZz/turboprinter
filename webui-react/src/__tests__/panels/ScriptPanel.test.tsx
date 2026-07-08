// webui-react/src/__tests__/panels/ScriptPanel.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ScriptPanel } from "../../components/panels/ScriptPanel";
import { useVideoStore } from "../../store/useVideoStore";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { useProjectStore } from "../../store/useProjectStore";
import { useWorkspacesStore } from "../../store/useWorkspacesStore";
import type { Workspace } from "../../api/types";

vi.mock("../../api/llm", () => ({
  llmApi: {
    generateScript: vi.fn().mockResolvedValue({ video_script: "Test script content" }),
    generateTerms: vi.fn().mockResolvedValue({ video_terms: ["cats", "animals"] }),
  },
}));

vi.mock("../../api/projects", () => ({
  projectsApi: {
    createFromScript: vi.fn(),
  },
}));

const ws1: Workspace = {
  id: "ws-1",
  name: "Canal EN",
  language: "en",
  voice_rate: 1.0,
  enabled: true,
  safety_rules: {},
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  act(() => useVideoStore.getState().reset());
  useWorkspacesStore.setState({
    workspaces: [],
    loading: false,
    error: null,
    fetchAll: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  });
});

function renderPanel() {
  return render(
    <MemoryRouter>
      <ScriptPanel />
    </MemoryRouter>
  );
}

describe("ScriptPanel", () => {
  it("renders topic input", () => {
    renderPanel();
    expect(screen.getByPlaceholderText(/ejercicio matutino/i)).toBeInTheDocument();
  });

  it("generate button is disabled when topic is empty", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: /generar guion/i })).toBeDisabled();
  });

  it("generate button enables when topic is filled", async () => {
    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/ejercicio matutino/i), "cats");
    expect(screen.getByRole("button", { name: /generar guion/i })).not.toBeDisabled();
  });

  it("updates store on script textarea change", async () => {
    renderPanel();
    const textarea = screen.getByPlaceholderText(/guion generado/i);
    await userEvent.type(textarea, "Hello world");
    expect(useVideoStore.getState().video_script).toContain("Hello world");
  });

  it("marks project mode as disabled when createFromScript 404s", async () => {
    vi.mocked(projectsApi.createFromScript).mockRejectedValue(
      new ApiError(404, "project mode disabled")
    );
    act(() => useProjectStore.getState().reset());

    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/ejercicio matutino/i), "cats");
    await userEvent.click(screen.getByRole("button", { name: /generar guion/i }));

    await waitFor(() => {
      expect(useProjectStore.getState().mode).toBe("disabled");
    });
  });

  it("selecting a workspace updates the video language to the workspace's language", async () => {
    useWorkspacesStore.setState({ workspaces: [ws1] });
    renderPanel();

    await userEvent.selectOptions(screen.getByLabelText(/canales/i), "ws-1");

    expect(useVideoStore.getState().video_language).toBe("en");
  });

  it("passes the selected workspace's id as workspace_id when generating", async () => {
    useWorkspacesStore.setState({ workspaces: [ws1] });
    vi.mocked(projectsApi.createFromScript).mockResolvedValue({ project_id: "proj-1", has_script: true });
    act(() => useProjectStore.getState().reset());
    useProjectStore.setState({ open: vi.fn().mockResolvedValue({} as never) });

    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/ejercicio matutino/i), "cats");
    await userEvent.selectOptions(screen.getByLabelText(/canales/i), "ws-1");
    await userEvent.click(screen.getByRole("button", { name: /generar guion/i }));

    await waitFor(() => {
      expect(projectsApi.createFromScript).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: "ws-1" })
      );
    });
  });

  it("passes workspace_id: undefined when no workspace is selected", async () => {
    useWorkspacesStore.setState({ workspaces: [ws1] });
    vi.mocked(projectsApi.createFromScript).mockResolvedValue({ project_id: "proj-1", has_script: true });
    act(() => useProjectStore.getState().reset());
    useProjectStore.setState({ open: vi.fn().mockResolvedValue({} as never) });

    renderPanel();
    await userEvent.type(screen.getByPlaceholderText(/ejercicio matutino/i), "cats");
    await userEvent.click(screen.getByRole("button", { name: /generar guion/i }));

    await waitFor(() => {
      expect(projectsApi.createFromScript).toHaveBeenCalledWith(
        expect.objectContaining({ workspace_id: undefined })
      );
    });
  });
});
