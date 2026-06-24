import { render, screen } from "@testing-library/react";
import { PipelineBar } from "../../components/layout/PipelineBar";
import type { WorkspacePanel } from "../../types/workspace";

describe("PipelineBar", () => {
  it("renders all five pipeline labels", () => {
    render(<PipelineBar currentPanel="script" completedPanels={[]} />);
    expect(screen.getByText("Script")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Generate")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("marks completed panels", () => {
    const { container } = render(
      <PipelineBar
        currentPanel="config"
        completedPanels={["script"] as WorkspacePanel[]}
      />
    );
    // completed step has a checkmark icon (data-testid="step-done-script")
    expect(container.querySelector('[data-testid="step-done-script"]')).toBeTruthy();
  });
});
