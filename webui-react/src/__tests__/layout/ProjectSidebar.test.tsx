import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectSidebar } from "../../components/layout/ProjectSidebar";
import { projectsApi } from "../../api/projects";

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
});
