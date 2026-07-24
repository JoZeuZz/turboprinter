import { describe, it, expect } from "vitest";
import {
  cssHexToAss,
  getAssFontName,
  formatAssTime,
  resolveLayoutFractions,
  resolveBackgroundColors,
  buildAnimTags,
  estimateLineWidth,
  getRoundedRectPath,
  generateAss,
} from "../../lib/subtitleLayout";
import { resolvePreviewStyle, PREVIEW_DIMS } from "../../lib/subtitlePreviewStyle";

describe("cssHexToAss", () => {
  it("converts #RRGGBB to BBGGRR", () => {
    expect(cssHexToAss("#FF8800")).toBe("0088FF");
  });
  it("expands #RGB shorthand", () => {
    expect(cssHexToAss("#f80")).toBe("0088ff");
  });
  it("drops alpha from #RRGGBBAA", () => {
    expect(cssHexToAss("#FF880080")).toBe("0088FF");
  });
  it("falls back to white on empty or invalid input", () => {
    expect(cssHexToAss("")).toBe("FFFFFF");
    expect(cssHexToAss("#12345")).toBe("FFFFFF");
  });
});

describe("getAssFontName", () => {
  it("maps known packaged fonts to their real family names", () => {
    expect(getAssFontName("STHeitiMedium.ttc")).toBe("STHeitiSC-Medium");
    expect(getAssFontName("MicrosoftYaHeiBold.ttc")).toBe("Microsoft YaHei");
  });
  it("strips extension for unknown fonts and defaults to Arial", () => {
    expect(getAssFontName("CustomFont.ttf")).toBe("CustomFont");
    expect(getAssFontName("")).toBe("Arial");
  });
});

describe("formatAssTime", () => {
  it("formats seconds as H:MM:SS.CS", () => {
    expect(formatAssTime(3661.5)).toBe("1:01:01.50");
    expect(formatAssTime(0)).toBe("0:00:00.00");
  });
});

describe("resolveLayoutFractions", () => {
  it("bottom: alignment 2, 8% vertical margin", () => {
    expect(resolveLayoutFractions("bottom", undefined)).toEqual({
      alignment: 2,
      marginVFrac: 0.08,
      anchor: "bottom",
      offsetPct: 8,
    });
  });
  it("top: alignment 8, 8% vertical margin", () => {
    expect(resolveLayoutFractions("top", undefined)).toEqual({
      alignment: 8,
      marginVFrac: 0.08,
      anchor: "top",
      offsetPct: 8,
    });
  });
  it("center and middle: alignment 5, no margin", () => {
    const expected = { alignment: 5, marginVFrac: 0, anchor: "center", offsetPct: 50 };
    expect(resolveLayoutFractions("center", undefined)).toEqual(expected);
    expect(resolveLayoutFractions("middle", undefined)).toEqual(expected);
  });
  it("custom: alignment 8 anchored top at the given percentage", () => {
    expect(resolveLayoutFractions("custom", 30)).toEqual({
      alignment: 8,
      marginVFrac: 0.3,
      anchor: "top",
      offsetPct: 30,
    });
  });
});

describe("resolveBackgroundColors", () => {
  it("boolean true with solid style gives an opaque black box", () => {
    expect(resolveBackgroundColors(true, "solid")).toEqual({
      enabled: true,
      color: "000000",
      alpha: "00",
    });
  });
  it("rgba string keeps its own alpha under translucent style", () => {
    expect(resolveBackgroundColors("rgba(0, 0, 0, 0.5)", "translucent")).toEqual({
      enabled: true,
      color: "000000",
      alpha: "80",
    });
  });
  it("translucent forces 50% alpha when the color was opaque", () => {
    expect(resolveBackgroundColors("#000000", "translucent")).toEqual({
      enabled: true,
      color: "000000",
      alpha: "80",
    });
  });
  it("blur overrides to a translucent white box", () => {
    expect(resolveBackgroundColors(true, "blur")).toEqual({
      enabled: true,
      color: "FFFFFF",
      alpha: "C0",
    });
  });
  it("false, transparent and none disable the background", () => {
    expect(resolveBackgroundColors(false, "solid").enabled).toBe(false);
    expect(resolveBackgroundColors("transparent", "solid").enabled).toBe(false);
    expect(resolveBackgroundColors("none", "solid").enabled).toBe(false);
  });
});

describe("buildAnimTags", () => {
  it("returns empty for none or undefined", () => {
    expect(buildAnimTags("none")).toBe("");
    expect(buildAnimTags(undefined)).toBe("");
  });
  it("returns ASS override tags per animation", () => {
    expect(buildAnimTags("fade")).toBe("\\fad(120,120)");
    expect(buildAnimTags("pop")).toContain("\\fscx80");
    expect(buildAnimTags("rotate")).toContain("\\frz-3.5");
  });
});

describe("estimateLineWidth", () => {
  it("scales with font size and char classes", () => {
    expect(estimateLineWidth("A", 100)).toBe(72);
    expect(estimateLineWidth("a", 100)).toBe(54);
    expect(estimateLineWidth("á", 100)).toBe(54);
    expect(estimateLineWidth("Aa 1", 100)).toBe(72 + 54 + 30 + 58);
  });
});

describe("getRoundedRectPath", () => {
  it("returns a plain rectangle when radius is 0", () => {
    expect(getRoundedRectPath(100, 50, 0)).toBe("m 0 0 l 100 0 l 100 50 l 0 50");
  });
  it("starts after the top-left curve when radius is positive", () => {
    expect(getRoundedRectPath(100, 50, 10).startsWith("m 10 0 ")).toBe(true);
    expect(getRoundedRectPath(100, 50, 10)).toContain("b ");
  });
});

const baseStyle = {
  fontName: "Arial",
  fontSize: 60,
  textColor: "#FFFFFF",
  strokeColor: "#000000",
  strokeWidth: 1.5,
  hasBg: false as boolean | string,
  position: "bottom",
  customPosition: 70,
};

const oneCue = [{ start_sec: 1, duration_sec: 2, text: "Hola mundo" }];

describe("generateAss", () => {
  it("emits PlayRes scaled to a 1920-high reference", () => {
    const out = generateAss(oneCue, 1080, 1920, baseStyle);
    expect(out).toContain("PlayResX: 1080");
    expect(out).toContain("PlayResY: 1920");
  });
  it("without background: single Dialogue positioned per layout", () => {
    const out = generateAss(oneCue, 1080, 1920, baseStyle);
    const dialogues = out.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(dialogues).toHaveLength(1);
    // bottom => \an2, centerY = 1920 - round(8% * 1920) = 1766, centerX = 540
    expect(dialogues[0]).toContain("\\an2\\pos(540,1766.0)");
    expect(dialogues[0]).toContain("Hola mundo");
  });
  it("with background: box on layer 0 (an7) and text on layer 1 (an8)", () => {
    const out = generateAss(oneCue, 1080, 1920, { ...baseStyle, hasBg: true });
    const dialogues = out.split("\n").filter((l) => l.startsWith("Dialogue:"));
    expect(dialogues).toHaveLength(2);
    expect(dialogues[0]).toMatch(/^Dialogue: 0,.*BgStyle.*\\an7\\pos\(.*\\p1/);
    expect(dialogues[1]).toMatch(/^Dialogue: 1,.*Default.*\\an8\\pos\(/);
  });
  it("applies animation tags to every dialogue line", () => {
    const out = generateAss(oneCue, 1080, 1920, {
      ...baseStyle,
      subtitleAnimation: "fade",
    });
    expect(out).toContain("\\fad(120,120)");
  });
  it("converts newlines to ASS \\N breaks", () => {
    const out = generateAss(
      [{ start_sec: 0, duration_sec: 2, text: "linea1\nlinea2" }],
      1080,
      1920,
      baseStyle
    );
    expect(out).toContain("linea1\\Nlinea2");
  });
});

describe("preview/render parity", () => {
  it("preview offsets derive from the same layout the render uses", () => {
    for (const position of ["top", "bottom", "center"]) {
      const layout = resolveLayoutFractions(position, undefined);
      const preview = resolvePreviewStyle(
        { fontSize: 60, strokeWidth: 1, position },
        PREVIEW_DIMS
      );
      expect(preview.position.offsetPct).toBe(layout.offsetPct);
      expect(preview.position.anchor).toBe(layout.anchor);
    }
  });
  it("custom position passes through identically on both sides", () => {
    const layout = resolveLayoutFractions("custom", 30);
    const preview = resolvePreviewStyle(
      { fontSize: 60, strokeWidth: 1, position: "custom", customPosition: 30 },
      PREVIEW_DIMS
    );
    expect(preview.position.offsetPct).toBe(layout.offsetPct);
  });
});
