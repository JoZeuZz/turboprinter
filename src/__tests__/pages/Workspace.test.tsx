// webui-react/src/__tests__/pages/Workspace.test.tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { Workspace } from "../../pages/Workspace";

vi.mock("../../api/projects", () => ({
  projectsApi: {
    getProject: vi.fn(),
  },
}));

beforeEach(() => useProjectWorkspaceStore.getState().reset());

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
    useProjectWorkspaceStore.setState({ panel: "done", videoUrls: ["/storage/renders/final.mp4"] });
    render(<MemoryRouter><Workspace /></MemoryRouter>);
    expect(screen.getByText(/Video listo/i)).toBeInTheDocument();
  });

});
