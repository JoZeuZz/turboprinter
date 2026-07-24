// webui-react/src/__tests__/panels/GeneratingPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneratingPanel } from "../../components/panels/GeneratingPanel";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";

beforeEach(() => {
  useProjectWorkspaceStore.getState().reset();
  useProjectStore.getState().reset();
});

describe("GeneratingPanel", () => {
  it("renders the project-mode checklist even before orchestration reports a step", () => {
    render(<GeneratingPanel />);
    expect(screen.getByText(/Planificando/i)).toBeInTheDocument();
    expect(screen.getByText(/narraci/i)).toBeInTheDocument();
  });

  it("renders the 4-step project-mode checklist when orchestration is running", () => {
    useProjectStore.setState({ orchestrationStep: "narration", mode: "loading" });
    render(<GeneratingPanel />);
    expect(screen.getByText(/Generando narraci/i)).toBeInTheDocument();
  });

  it("shows retry button and error when a project-mode step fails", async () => {
    useProjectStore.setState({
      orchestrationStep: "media",
      mode: "error",
      error: "no clips found",
    });
    render(<GeneratingPanel />);
    expect(screen.getByText("no clips found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("shows retry button and error when project mode becomes disabled mid-orchestration", async () => {
    useProjectStore.setState({
      orchestrationStep: "plan",
      mode: "disabled",
      error: "project mode disabled",
    });
    render(<GeneratingPanel />);
    expect(screen.getByText("project mode disabled")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("retry button calls generateViaProjectMode again", async () => {
    const generateViaProjectMode = vi.fn();
    useProjectStore.setState({
      orchestrationStep: "media",
      mode: "error",
      error: "no clips found",
      generateViaProjectMode,
    });
    render(<GeneratingPanel />);
    await userEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(generateViaProjectMode).toHaveBeenCalled();
  });
});
