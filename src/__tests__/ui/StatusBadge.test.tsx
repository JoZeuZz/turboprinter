import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "../../components/ui/StatusBadge";

describe("StatusBadge", () => {
  it("shows connectivity when loading", () => {
    render(<StatusBadge mode="loading" panel="done" />);
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });
  it("shows offline when disabled", () => {
    render(<StatusBadge mode="disabled" panel="script" />);
    expect(screen.getByText("Sin conexión")).toBeInTheDocument();
  });
  it("shows the phase label when idle/ready", () => {
    render(<StatusBadge mode="ready" panel="done" />);
    expect(screen.getByText("Terminado")).toBeInTheDocument();
  });
});
