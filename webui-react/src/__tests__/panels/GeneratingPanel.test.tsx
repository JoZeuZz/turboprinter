// webui-react/src/__tests__/panels/GeneratingPanel.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GeneratingPanel } from "../../components/panels/GeneratingPanel";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useVideoStore } from "../../store/useVideoStore";

beforeEach(() => {
  useProjectWorkspaceStore.getState().reset();
  useProjectStore.getState().reset();
});

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
    expect(screen.getByText(/Guion/i)).toBeInTheDocument();
    expect(screen.getByText(/Audio/i)).toBeInTheDocument();
    expect(screen.getByText(/clips/i)).toBeInTheDocument();
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
