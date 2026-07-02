import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubtitlePreview } from "../../components/subtitles/SubtitlePreview";

describe("SubtitlePreview", () => {
  it("renders the sample text and applies calibrated font size (smaller than legacy)", () => {
    render(<SubtitlePreview enabled position="bottom" fontSize={60} sampleText="Hola mundo" />);
    const span = screen.getByText("Hola mundo");
    const fontSize = parseFloat((span as HTMLElement).style.fontSize);
    // calibrated 60 * 373/1920 ≈ 11.66 — well below the legacy clamp floor of 16
    expect(fontSize).toBeGreaterThan(9);
    expect(fontSize).toBeLessThan(14);
  });

  it("renders no background box when backgroundColor is false", () => {
    render(
      <SubtitlePreview enabled position="top" fontSize={60} textBackgroundColor={false} sampleText="Sin fondo" />
    );
    expect(screen.getByText("Sin fondo")).toBeInTheDocument();
  });
});
