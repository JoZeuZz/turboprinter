import { describe, expect, it } from "vitest";
import fixtures from "../../lib/__fixtures__/subtitlePreviewParity.json";
import { resolvePreviewStyle, PREVIEW_DIMS } from "../../lib/subtitlePreviewStyle";

function bandOf(anchor: string, offsetPct: number): "top" | "center" | "bottom" {
  if (anchor === "top") return "top";
  if (anchor === "center") return "center";
  return "bottom";
}

describe("resolvePreviewStyle", () => {
  it("scales font by previewHeight/1920", () => {
    const s = resolvePreviewStyle({ fontSize: 60, strokeWidth: 1.5, position: "bottom" }, PREVIEW_DIMS);
    // 60 * 373/1920 ≈ 11.66
    expect(s.fontSizePx).toBeGreaterThan(10);
    expect(s.fontSizePx).toBeLessThan(13);
  });

  it("stroke follows the render's font-relative rule, scaled", () => {
    const none = resolvePreviewStyle({ fontSize: 60, strokeWidth: 0, position: "bottom" }, PREVIEW_DIMS);
    expect(none.strokePx).toBe(0);
    const s = resolvePreviewStyle({ fontSize: 60, strokeWidth: 1.5, position: "bottom" }, PREVIEW_DIMS);
    // render stroke = max(round(1.5), round(60*0.06)=4) = 4; *SCALE ≈ 0.78
    expect(s.strokePx).toBeGreaterThan(0.5);
    expect(s.strokePx).toBeLessThan(1.2);
  });

  it("maps positions to render-matching bands", () => {
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "bottom" }, PREVIEW_DIMS).position).toEqual({ anchor: "bottom", offsetPct: 5 });
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "top" }, PREVIEW_DIMS).position).toEqual({ anchor: "top", offsetPct: 5 });
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "center" }, PREVIEW_DIMS).position).toEqual({ anchor: "center", offsetPct: 50 });
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "custom", customPosition: 30 }, PREVIEW_DIMS).position).toEqual({ anchor: "top", offsetPct: 30 });
  });

  it("resolves background like the render", () => {
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "bottom", backgroundColor: false }, PREVIEW_DIMS).background).toBeNull();
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "bottom", backgroundColor: true }, PREVIEW_DIMS).background).toEqual({ color: "#000000", rounded: false });
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "bottom", backgroundColor: "#123456", roundedBackground: true }, PREVIEW_DIMS).background).toEqual({ color: "#123456", rounded: true });
  });

  it("agrees with every parity fixture on band and background presence", () => {
    for (const fx of fixtures as Array<{ style: any; band: string; hasBackground: boolean }>) {
      const s = resolvePreviewStyle(fx.style, PREVIEW_DIMS);
      expect(bandOf(s.position.anchor, s.position.offsetPct)).toBe(fx.band);
      expect(s.background !== null).toBe(fx.hasBackground);
    }
  });

  it("treats null/empty background as no background (mirrors render)", () => {
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "bottom", backgroundColor: null }, PREVIEW_DIMS).background).toBeNull();
    expect(resolvePreviewStyle({ fontSize: 60, strokeWidth: 1, position: "bottom", backgroundColor: "" }, PREVIEW_DIMS).background).toBeNull();
  });

  it("normalizes an empty stroke color to the fallback without zeroing the stroke", () => {
    const s = resolvePreviewStyle({ fontSize: 60, strokeWidth: 1.5, position: "bottom", strokeColor: "" }, PREVIEW_DIMS);
    expect(s.strokeColor).toBe("#000000");
    expect(s.strokePx).toBeGreaterThan(0);
  });
});
