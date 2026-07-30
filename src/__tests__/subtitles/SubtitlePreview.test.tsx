import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
    const text = screen.getByText("Sin fondo");
    expect(text).toBeInTheDocument();
    expect((text.parentElement as HTMLElement).style.backgroundColor).toBe("transparent");
  });

  describe("real cue playback", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("shows the first real cue from the shared splitter, then cycles to the next", () => {
      vi.useFakeTimers();
      render(
        <SubtitlePreview
          enabled
          position="bottom"
          fontSize={60}
          sampleText="uno dos tres cuatro cinco"
        />
      );
      // 5 words -> cues of the shared engine: "uno dos tres" + "cuatro cinco"
      expect(screen.getByText("uno dos tres")).toBeInTheDocument();
      expect(screen.queryByText("cuatro cinco")).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1200); // 3 units * 0.4s per unit
      });
      expect(screen.getByText("cuatro cinco")).toBeInTheDocument();
      expect(screen.queryByText("uno dos tres")).not.toBeInTheDocument();
    });

    it("keeps a short sample as a single cue", () => {
      vi.useFakeTimers();
      render(<SubtitlePreview enabled position="bottom" fontSize={60} sampleText="Hola mundo" />);
      expect(screen.getByText("Hola mundo")).toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(screen.getByText("Hola mundo")).toBeInTheDocument();
    });
  });
});
