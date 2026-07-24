import { describe, it, expect } from "vitest";
import {
  cssHexToAss,
  getAssFontName,
  formatAssTime,
  resolveLayoutFractions,
  resolveBackgroundColors,
  resolveBackgroundSpec,
  backgroundSpecToCss,
  normalizeColor,
  buildAnimTags,
  estimateLineWidth,
  getRoundedRectPath,
  generateAss,
  splitTextIntoTikTokSubtitles,
  formatSrtTime,
  generateSrt,
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

describe("normalizeColor", () => {
  it("returns the trimmed color when present", () => {
    expect(normalizeColor(" #ff8800 ", "#FFFFFF")).toBe("#ff8800");
  });
  it("falls back on empty, blank, null or undefined", () => {
    expect(normalizeColor("", "#FFFFFF")).toBe("#FFFFFF");
    expect(normalizeColor("   ", "#000000")).toBe("#000000");
    expect(normalizeColor(null, "#000000")).toBe("#000000");
    expect(normalizeColor(undefined, "#FFFFFF")).toBe("#FFFFFF");
  });
});

describe("resolveBackgroundSpec", () => {
  it("boolean true with solid style gives an opaque black box", () => {
    expect(resolveBackgroundSpec(true, "solid")).toEqual({
      enabled: true,
      r: 0,
      g: 0,
      b: 0,
      assAlpha: 0,
    });
  });
  it("hex color parses to rgb components", () => {
    expect(resolveBackgroundSpec("#123456", "solid")).toEqual({
      enabled: true,
      r: 18,
      g: 52,
      b: 86,
      assAlpha: 0,
    });
  });
  it("translucent forces 50% when the color was opaque", () => {
    expect(resolveBackgroundSpec(true, "translucent").assAlpha).toBe(128);
  });
  it("rgba string keeps its own alpha under translucent style", () => {
    expect(resolveBackgroundSpec("rgba(0, 0, 0, 0.5)", "translucent").assAlpha).toBe(128);
  });
  it("blur overrides to a translucent white box", () => {
    expect(resolveBackgroundSpec(true, "blur")).toEqual({
      enabled: true,
      r: 255,
      g: 255,
      b: 255,
      assAlpha: 192,
    });
  });
  it("false, transparent and none disable the background", () => {
    expect(resolveBackgroundSpec(false, "solid").enabled).toBe(false);
    expect(resolveBackgroundSpec("transparent", "solid").enabled).toBe(false);
    expect(resolveBackgroundSpec("none", "solid").enabled).toBe(false);
  });
});

describe("backgroundSpecToCss", () => {
  it("solid black spec becomes fully opaque rgba", () => {
    expect(backgroundSpecToCss(resolveBackgroundSpec(true, "solid"))).toBe("rgba(0, 0, 0, 1)");
  });
  it("blur spec becomes translucent white rgba", () => {
    expect(backgroundSpecToCss(resolveBackgroundSpec(true, "blur"))).toBe(
      "rgba(255, 255, 255, 0.25)"
    );
  });
  it("translucent spec halves the opacity", () => {
    expect(backgroundSpecToCss(resolveBackgroundSpec("#000000", "translucent"))).toBe(
      "rgba(0, 0, 0, 0.5)"
    );
  });
  it("disabled spec yields null", () => {
    expect(backgroundSpecToCss(resolveBackgroundSpec(false, "solid"))).toBeNull();
  });
});

describe("resolveBackgroundColors stays consistent with the canonical spec", () => {
  it("derives the same ASS alpha hex as the spec", () => {
    expect(resolveBackgroundColors(true, "blur").alpha).toBe("C0");
    expect(resolveBackgroundColors(true, "translucent").alpha).toBe("80");
  });
});

describe("splitTextIntoTikTokSubtitles", () => {
  it("returns empty for blank text", () => {
    expect(splitTextIntoTikTokSubtitles("", 0, 5, "seg_1", "sub_1")).toEqual([]);
    expect(splitTextIntoTikTokSubtitles("   ", 0, 5, "seg_1", "sub_1")).toEqual([]);
  });
  it("groups words in cues of up to 3 with proportional timing", () => {
    const cues = splitTextIntoTikTokSubtitles("uno dos tres cuatro cinco", 10, 5, "seg_1", "sub_1");
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({
      id: "sub_1_part_1",
      text: "uno dos tres",
      start_sec: 10,
      duration_sec: 3,
      segment_id: "seg_1",
    });
    expect(cues[1]).toMatchObject({
      id: "sub_1_part_2",
      text: "cuatro cinco",
      start_sec: 13,
      duration_sec: 2,
    });
  });
  it("merges a lone trailing word into the previous cue", () => {
    const cues = splitTextIntoTikTokSubtitles("uno dos tres cuatro", 0, 4, "seg_1", "sub_1");
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("uno dos tres cuatro");
  });
  it("splits CJK text per character without spaces", () => {
    const cues = splitTextIntoTikTokSubtitles("你好世界啊", 0, 5, "seg_1", "sub_1");
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("你好世");
    expect(cues[1].text).toBe("界啊");
  });
});

describe("formatSrtTime", () => {
  it("formats seconds as HH:MM:SS,mmm", () => {
    expect(formatSrtTime(3661.5)).toBe("01:01:01,500");
    expect(formatSrtTime(0)).toBe("00:00:00,000");
  });
});

describe("generateSrt", () => {
  it("emits numbered blocks with arrow separators", () => {
    const srt = generateSrt([
      { start_sec: 0, duration_sec: 2, text: "Hola" },
      { start_sec: 2, duration_sec: 3, text: "mundo" },
    ]);
    expect(srt).toContain("1\n00:00:00,000 --> 00:00:02,000\nHola\n");
    expect(srt).toContain("2\n00:00:02,000 --> 00:00:05,000\nmundo\n");
  });
});

describe("generateAss color fallbacks", () => {
  it("blank stroke color falls back to black, blank text color to white", () => {
    const out = generateAss(oneCue, 1080, 1920, {
      ...baseStyle,
      textColor: "",
      strokeColor: "  ",
    });
    const defaultStyle = out.split("\n").find((l) => l.startsWith("Style: Default"));
    expect(defaultStyle).toContain("&H00FFFFFF"); // primary: white fallback
    expect(defaultStyle).toContain("&H00000000"); // outline: black fallback
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
