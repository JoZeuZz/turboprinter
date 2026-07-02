import { render, screen } from "@testing-library/react";
import { PipelineBar } from "../../components/layout/PipelineBar";
import type { WorkspacePanel } from "../../types/workspace";

describe("PipelineBar", () => {
  it("renders all five pipeline labels", () => {
    render(<PipelineBar currentPanel="script" completedPanels={[]} />);
    expect(screen.getByText("Guion")).toBeInTheDocument();
    expect(screen.getByText("Configuración")).toBeInTheDocument();
    expect(screen.getByText("Generar")).toBeInTheDocument();
    expect(screen.getByText("Revisión")).toBeInTheDocument();
    expect(screen.getByText("Listo")).toBeInTheDocument();
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
