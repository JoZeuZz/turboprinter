// webui-react/src/__tests__/panels/GeneratingPanel.test.tsx
import { render, screen } from "@testing-library/react";
import { GeneratingPanel } from "../../components/panels/GeneratingPanel";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

beforeEach(() => useProjectWorkspaceStore.getState().reset());

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
    expect(screen.getByText(/Script/i)).toBeInTheDocument();
    expect(screen.getByText(/Audio/i)).toBeInTheDocument();
    expect(screen.getByText(/Clips/i)).toBeInTheDocument();
  });
});
