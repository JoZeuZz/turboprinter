import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OriginBadge } from "../../components/layout/OriginBadge";

describe("OriginBadge", () => {
  it("renders the Spanish label and data-origin for draft", () => {
    render(<OriginBadge origin="draft" />);
    const badge = screen.getByTestId("origin-badge");
    expect(badge).toHaveAttribute("data-origin", "draft");
    expect(badge).toHaveTextContent("Sin guardar");
  });

  it("renders history", () => {
    render(<OriginBadge origin="history" />);
    expect(screen.getByTestId("origin-badge")).toHaveTextContent("Desde historial");
  });

  it("renders generating", () => {
    render(<OriginBadge origin="generating" />);
    expect(screen.getByTestId("origin-badge")).toHaveTextContent("Generando");
  });

  it("renders finished", () => {
    render(<OriginBadge origin="finished" />);
    expect(screen.getByTestId("origin-badge")).toHaveTextContent("Generado");
  });
});
