import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSidebar } from "../../components/layout/ProjectSidebar";
import { projectsApi } from "../../api/projects";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import type { TaskStatus } from "../../api/types";

vi.mock("../../api/projects", () => ({
  projectsApi: {
    listProjects: vi.fn(),
    deleteProject: vi.fn(),
    renameProject: vi.fn(),
    duplicateProject: vi.fn(),
  },
}));

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/project/proj-aaa"]}>
      <ProjectSidebar />
    </MemoryRouter>
  );
}

describe("ProjectSidebar actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (projectsApi.listProjects as any).mockResolvedValue({
      projects: [{ project_id: "proj-aaa", topic: "Mi video", updated_at: "2026-07-01T00:00:00Z" }],
    });
    (projectsApi.deleteProject as any).mockResolvedValue({ project_id: "proj-aaa", deleted: true });
    (projectsApi.renameProject as any).mockResolvedValue({ project_id: "proj-aaa", topic: "Nuevo" });
    (projectsApi.duplicateProject as any).mockResolvedValue({ project_id: "proj-new" });
  });

  it("opens the row menu and deletes a project after confirm", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Mi video");

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Eliminar"));
    // Confirm step
    await user.click(screen.getByText("Confirmar"));

    await waitFor(() => expect(projectsApi.deleteProject).toHaveBeenCalledWith("proj-aaa"));
  });

  it("renames a project via inline edit", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Mi video");

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Renombrar"));

    const input = screen.getByDisplayValue("Mi video");
    await user.clear(input);
    await user.type(input, "Nuevo{Enter}");

    await waitFor(() =>
      expect(projectsApi.renameProject).toHaveBeenCalledWith("proj-aaa", "Nuevo")
    );
  });

  it("renames a project to a multi-word name without dropping spaces", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Mi video");

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Renombrar"));

    const input = screen.getByDisplayValue("Mi video");
    await user.clear(input);
    await user.type(input, "Mi video nuevo{Enter}");

    await waitFor(() =>
      expect(projectsApi.renameProject).toHaveBeenCalledWith("proj-aaa", "Mi video nuevo")
    );
  });

  it("duplicates a project", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Mi video");

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Duplicar"));

    await waitFor(() => expect(projectsApi.duplicateProject).toHaveBeenCalledWith("proj-aaa"));
  });

  it("discards the edit and does not rename when Escape is pressed", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Mi video");

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Renombrar"));

    const input = screen.getByDisplayValue("Mi video");
    await user.clear(input);
    await user.type(input, "Nombre descartado{Escape}");

    // The row should fall back to displaying the original label, not the input.
    await screen.findByText("Mi video");
    expect(screen.queryByDisplayValue("Nombre descartado")).not.toBeInTheDocument();
    expect(projectsApi.renameProject).not.toHaveBeenCalled();
  });

  it("commits exactly once when Enter is pressed", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Mi video");

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Renombrar"));

    const input = screen.getByDisplayValue("Mi video");
    await user.clear(input);
    await user.type(input, "Nuevo{Enter}");

    await waitFor(() =>
      expect(projectsApi.renameProject).toHaveBeenCalledWith("proj-aaa", "Nuevo")
    );
    expect(projectsApi.renameProject).toHaveBeenCalledTimes(1);
  });

  it("allows renaming again after a previous commit (commit guard resets per session)", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Mi video");

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Renombrar"));
    let input = screen.getByDisplayValue("Mi video");
    await user.clear(input);
    await user.type(input, "Primero{Enter}");
    await waitFor(() => expect(projectsApi.renameProject).toHaveBeenCalledTimes(1));

    await user.click(screen.getByLabelText("Acciones de Mi video"));
    await user.click(screen.getByText("Renombrar"));
    input = screen.getByDisplayValue("Mi video");
    await user.clear(input);
    await user.type(input, "Segundo{Enter}");
    await waitFor(() => expect(projectsApi.renameProject).toHaveBeenCalledTimes(2));
    expect(projectsApi.renameProject).toHaveBeenNthCalledWith(2, "proj-aaa", "Segundo");
  });
});

describe("ProjectSidebar listing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useProjectHistoryStore.setState({ drafts: [], currentDraftId: null });
    useProjectWorkspaceStore.setState({ topic: "", taskId: null, taskStatus: null });
    (projectsApi.listProjects as any).mockResolvedValue({ projects: [] });
  });

  function renderAtRoute(id: string) {
    return render(
      <MemoryRouter initialEntries={[`/project/${id}`]}>
        <Routes>
          <Route path="/project/:id" element={<ProjectSidebar />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it("renders a draft from the history store", async () => {
    useProjectHistoryStore.setState({
      drafts: [
        { project_id: "draft-1", topic: "Mi borrador", updated_at: "2026-07-01T00:00:00Z", kind: "draft" },
      ],
    });
    renderSidebar();

    await screen.findByText("Mi borrador");
    const rows = screen.getAllByTestId("sidebar-row");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("Mi borrador");
    expect(rows[0]).toHaveTextContent("Borrador");
  });

  it("renders a persisted project from listProjects", async () => {
    (projectsApi.listProjects as any).mockResolvedValue({
      projects: [{ project_id: "p1", topic: "Proyecto uno", updated_at: "2026-07-01T00:00:00Z" }],
    });
    renderSidebar();

    await screen.findByText("Proyecto uno");
    const rows = screen.getAllByTestId("sidebar-row");
    expect(rows).toHaveLength(1);
    // subtitle is the formatted date, not "Borrador"
    expect(rows[0]).not.toHaveTextContent("Borrador");
  });

  it("de-duplicates: an id present as both draft and project renders once", async () => {
    useProjectHistoryStore.setState({
      drafts: [
        { project_id: "dup", topic: "Entrada duplicada", updated_at: "2026-07-01T00:00:00Z", kind: "draft" },
      ],
    });
    (projectsApi.listProjects as any).mockResolvedValue({
      projects: [{ project_id: "dup", topic: "Entrada duplicada", updated_at: "2026-07-01T00:00:00Z" }],
    });
    renderSidebar();

    await screen.findByText("Entrada duplicada");
    expect(screen.getAllByTestId("sidebar-row")).toHaveLength(1);
  });

  it("orders rows by updated_at descending (newest first)", async () => {
    useProjectHistoryStore.setState({
      drafts: [
        { project_id: "draft-old", topic: "Borrador viejo", updated_at: "2026-07-01T00:00:00Z", kind: "draft" },
      ],
    });
    (projectsApi.listProjects as any).mockResolvedValue({
      projects: [{ project_id: "p-new", topic: "Proyecto nuevo", updated_at: "2026-07-02T00:00:00Z" }],
    });
    renderSidebar();

    await screen.findByText("Proyecto nuevo");
    const rows = screen.getAllByTestId("sidebar-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Proyecto nuevo"); // newer sorts first
    expect(rows[1]).toHaveTextContent("Borrador viejo");
  });

  it("shows no rows when there are no drafts and no projects", async () => {
    renderSidebar();
    // let the initial refreshProjects() promise resolve
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalled());
    expect(screen.queryAllByTestId("sidebar-row")).toHaveLength(0);
  });

  it("shows a new project in history after a generation task completes", async () => {
    (projectsApi.listProjects as any)
      .mockResolvedValueOnce({ projects: [] })
      .mockResolvedValue({
        projects: [{ project_id: "p-new", topic: "Video generado", updated_at: "2026-07-02T00:00:00Z" }],
      });
    renderSidebar();
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalledTimes(1));
    expect(screen.queryAllByTestId("sidebar-row")).toHaveLength(0);

    // simulate the generation task reaching completion -> taskState dependency changes
    act(() => {
      useProjectWorkspaceStore.setState({
        taskId: "t1",
        taskStatus: { state: 1 } as TaskStatus,
      });
    });

    await screen.findByText("Video generado");
    expect((projectsApi.listProjects as any).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("marks the active project row with aria-current", async () => {
    (projectsApi.listProjects as any).mockResolvedValue({
      projects: [
        { project_id: "p1", topic: "Proyecto activo", updated_at: "2026-07-02T00:00:00Z" },
        { project_id: "p2", topic: "Proyecto inactivo", updated_at: "2026-07-01T00:00:00Z" },
      ],
    });
    renderAtRoute("p1");

    await screen.findByText("Proyecto activo");
    const activeRow = screen.getByText("Proyecto activo").closest('[data-testid="sidebar-row"]');
    const inactiveRow = screen.getByText("Proyecto inactivo").closest('[data-testid="sidebar-row"]');
    expect(activeRow).toHaveAttribute("aria-current", "true");
    expect(inactiveRow).not.toHaveAttribute("aria-current");
  });
});
