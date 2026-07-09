// webui-react/src/__tests__/pages/Workspaces.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Workspaces } from "../../pages/Workspaces";
import { useWorkspacesStore } from "../../store/useWorkspacesStore";
import { useJobsStore } from "../../store/useJobsStore";
import type { Workspace } from "../../api/types";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  );
  return { ...actual, useNavigate: () => navigateMock };
});

const ws1: Workspace = {
  id: "ws-1", name: "Canal Curiosidades", language: "es", voice_rate: 1.0,
  enabled: true, safety_rules: {}, metadata: {},
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  navigateMock.mockReset();
  useWorkspacesStore.setState({
    workspaces: [],
    loading: false,
    error: null,
    fetchAll: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  });
  useJobsStore.setState({
    jobs: [],
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    runFullPipeline: vi.fn().mockResolvedValue({ job_id: "job-1", project_id: "p-1" }),
  });
});

describe("Workspaces page", () => {
  it("shows empty state when there are no workspaces", async () => {
    render(<MemoryRouter><Workspaces /></MemoryRouter>);
    await waitFor(() => {
      expect(useWorkspacesStore.getState().fetchAll).toHaveBeenCalled();
    });
    expect(screen.getByText(/todav.a no creaste/i)).toBeInTheDocument();
  });

  it("lists existing workspaces by name", () => {
    useWorkspacesStore.setState({ workspaces: [ws1] });
    render(<MemoryRouter><Workspaces /></MemoryRouter>);
    expect(screen.getByText("Canal Curiosidades")).toBeInTheDocument();
  });

  it("creating a workspace calls the store's create action", async () => {
    const createMock = vi.fn().mockResolvedValue(ws1);
    useWorkspacesStore.setState({ create: createMock });
    render(<MemoryRouter><Workspaces /></MemoryRouter>);

    fireEvent.click(screen.getByRole("button", { name: /nuevo canal/i }));
    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: "Misterio Shorts" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Misterio Shorts" })
      );
    });
  });

  it("running the full pipeline calls the jobs store and navigates to /jobs", async () => {
    useWorkspacesStore.setState({ workspaces: [ws1] });
    render(<MemoryRouter><Workspaces /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText(/run full pipeline|ejecutar pipeline/i), {
      target: { value: "gatos" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run full pipeline|ejecutar pipeline/i }));

    await waitFor(() => {
      expect(useJobsStore.getState().runFullPipeline).toHaveBeenCalledWith("ws-1", {
        topic: "gatos",
        language: "es",
      });
    });
    expect(navigateMock).toHaveBeenCalledWith("/jobs");
  });
});
