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
