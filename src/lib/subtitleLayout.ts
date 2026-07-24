// Single source of truth for subtitle geometry and ASS generation.
// Consumed by server.ts (render) and subtitlePreviewStyle.ts (editor preview):
// any layout change here propagates to both, keeping preview === render.

export interface SubtitleCue {
  start_sec?: number | string;
  duration_sec?: number | string;
  text?: string;
}

export interface AssStyleParams {
  fontName: string;
  fontSize: number;
  textColor: string;
  strokeColor: string;
  strokeWidth: number;
  hasBg: boolean | string;
  position: string;
  customPosition: number;
  subtitleBgStyle?: string;
  roundedBackground?: boolean;
  subtitleAnimation?: string;
}

export interface LayoutFractions {
  alignment: 2 | 5 | 8;
  marginVFrac: number;
  anchor: "top" | "bottom" | "center";
  offsetPct: number;
}

export interface BackgroundColors {
  enabled: boolean;
  color: string;
  alpha: string;
}

// Canonical background: RGB components plus ASS alpha (0 = opaque, 255 = invisible).
// Both adapters derive from this — ASS via resolveBackgroundColors, CSS via backgroundSpecToCss.
export interface BackgroundSpec {
  enabled: boolean;
  r: number;
  g: number;
  b: number;
  assAlpha: number;
}

export interface SplitSubtitleCue {
  id: string;
  start_sec: number;
  duration_sec: number;
  text: string;
  segment_id: string;
}

export const REF_HEIGHT = 1920;

export const cssHexToAss = (hex: string): string => {
  if (!hex) return "FFFFFF";
  let clean = hex.replace("#", "");
  if (clean.length === 3) {
    clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
  }
  if (clean.length === 6 || clean.length === 8) {
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `${b}${g}${r}`; // BBGGRR
  }
  return "FFFFFF";
};

export const getAssFontName = (fontName: string): string => {
  if (!fontName) return "Arial";
  const clean = fontName.trim();
  if (clean.startsWith("STHeitiMedium")) return "STHeitiSC-Medium";
  if (clean.startsWith("STHeitiLight")) return "STHeitiSC-Light";
  if (clean.startsWith("MicrosoftYaHeiBold")) return "Microsoft YaHei";
  if (clean.startsWith("MicrosoftYaHeiNormal")) return "Microsoft YaHei";
  if (clean.startsWith("Charm-Bold")) return "Charm";
  if (clean.startsWith("Charm-Regular")) return "Charm";
  if (clean.startsWith("UTM Kabel KY")) return "UTM Kabel KY";
  if (clean.startsWith("UTM_Kabel_KY")) return "UTM Kabel KY";
  return clean.split(".")[0] || "Arial";
};

export const formatAssTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  const cs = Math.floor(ms / 10);
  return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
};

export const resolveLayoutFractions = (
  position: string,
  customPosition: number | undefined
): LayoutFractions => {
  if (position === "top") {
    return { alignment: 8, marginVFrac: 0.08, anchor: "top", offsetPct: 8 };
  }
  if (position === "center" || position === "middle") {
    return { alignment: 5, marginVFrac: 0, anchor: "center", offsetPct: 50 };
  }
  if (position === "custom") {
    const pct = customPosition ?? 70;
    return { alignment: 8, marginVFrac: pct / 100, anchor: "top", offsetPct: pct };
  }
  return { alignment: 2, marginVFrac: 0.08, anchor: "bottom", offsetPct: 8 };
};

export const normalizeColor = (
  color: string | null | undefined,
  fallback: string
): string => color?.trim() || fallback;

export const resolveBackgroundSpec = (
  hasBg: boolean | string,
  subtitleBgStyle: string | undefined
): BackgroundSpec => {
  const enabled =
    hasBg === true ||
    (typeof hasBg === "string" &&
      Boolean(hasBg.trim()) &&
      hasBg.trim() !== "transparent" &&
      hasBg.trim() !== "none");

  let r = 0;
  let g = 0;
  let b = 0;
  let assAlpha = 0; // fully opaque box by default

  if (!enabled) return { enabled: false, r, g, b, assAlpha };

  if (typeof hasBg === "string" && hasBg.trim()) {
    const cleanBg = hasBg.trim();
    if (cleanBg.startsWith("#")) {
      let clean = cleanBg.replace("#", "");
      if (clean.length === 3) {
        clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
      }
      if (clean.length === 6 || clean.length === 8) {
        r = parseInt(clean.substring(0, 2), 16);
        g = parseInt(clean.substring(2, 4), 16);
        b = parseInt(clean.substring(4, 6), 16);
        if (clean.length === 8) {
          assAlpha = 255 - parseInt(clean.substring(6, 8), 16);
        }
      } else {
        r = g = b = 255; // invalid hex: same white fallback as cssHexToAss
      }
    } else if (cleanBg.startsWith("rgba")) {
      const match = cleanBg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
        assAlpha = Math.round((1 - parseFloat(match[4])) * 255);
      }
    } else if (cleanBg.startsWith("rgb")) {
      const match = cleanBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (match) {
        r = parseInt(match[1]);
        g = parseInt(match[2]);
        b = parseInt(match[3]);
      }
    }
  }

  if (subtitleBgStyle === "translucent") {
    if (assAlpha === 0) assAlpha = 128; // 50% transparency
  } else if (subtitleBgStyle === "blur") {
    r = g = b = 255;
    assAlpha = 192; // 25% opacity white box
  } else {
    assAlpha = 0; // solid: force opaque
  }

  return { enabled, r, g, b, assAlpha };
};

export const backgroundSpecToCss = (spec: BackgroundSpec): string | null => {
  if (!spec.enabled) return null;
  const opacity = Math.round(((255 - spec.assAlpha) / 255) * 100) / 100;
  return `rgba(${spec.r}, ${spec.g}, ${spec.b}, ${opacity})`;
};

export const resolveBackgroundColors = (
  hasBg: boolean | string,
  subtitleBgStyle: string | undefined
): BackgroundColors => {
  const spec = resolveBackgroundSpec(hasBg, subtitleBgStyle);
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return {
    enabled: spec.enabled,
    color: `${toHex(spec.b)}${toHex(spec.g)}${toHex(spec.r)}`,
    alpha: toHex(spec.assAlpha),
  };
};

export const buildAnimTags = (animation: string | undefined): string => {
  if (animation === "pop") {
    return "\\fscx80\\fscy80\\t(0,70,\\fscx114\\fscy114)\\t(70,140,\\fscx100\\fscy100)";
  }
  if (animation === "fade") {
    return "\\fad(120,120)";
  }
  if (animation === "rotate") {
    return "\\frz-3.5\\fscx80\\fscy80\\t(0,80,\\frz2\\fscx112\\fscy112)\\t(80,150,\\frz0\\fscx100\\fscy100)";
  }
  return "";
};

export const estimateLineWidth = (line: string, fontSize: number): number => {
  let width = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === " ") {
      width += 0.3;
    } else if (/[A-Z]/.test(char)) {
      width += 0.72;
    } else if (/[a-z]/.test(char)) {
      width += 0.54;
    } else if (/[0-9]/.test(char)) {
      width += 0.58;
    } else if (/[áéíóúÁÉÍÓÚñÑüÜ]/.test(char)) {
      width += 0.54;
    } else {
      width += 0.45;
    }
  }
  return width * fontSize;
};

export const getRoundedRectPath = (w: number, h: number, r: number): string => {
  if (r <= 0) {
    return `m 0 0 l ${Math.round(w)} 0 l ${Math.round(w)} ${Math.round(h)} l 0 ${Math.round(h)}`;
  }
  const kappa = 0.5522847498;

  let p = `m ${Math.round(r)} 0 `;
  p += `l ${Math.round(w - r)} 0 `;
  p += `b ${Math.round(w - r + r * kappa)} 0 ${Math.round(w)} ${Math.round(r - r * kappa)} ${Math.round(w)} ${Math.round(r)} `;
  p += `l ${Math.round(w)} ${Math.round(h - r)} `;
  p += `b ${Math.round(w)} ${Math.round(h - r + r * kappa)} ${Math.round(w - r + r * kappa)} ${Math.round(h)} ${Math.round(w - r)} ${Math.round(h)} `;
  p += `l ${Math.round(r)} ${Math.round(h)} `;
  p += `b ${Math.round(r - r * kappa)} ${Math.round(h)} 0 ${Math.round(h - r + r * kappa)} 0 ${Math.round(h - r)} `;
  p += `l 0 ${Math.round(r)} `;
  p += `b 0 ${Math.round(r - r * kappa)} ${Math.round(r - r * kappa)} 0 ${Math.round(r)} 0`;

  return p;
};

// TikTok-style cue splitting: groups of up to 3 words (or CJK characters),
// timed proportionally inside the segment's narration window. Used by the
// render (ASS/SRT) and the editor preview so both show the exact same cues.
export const splitTextIntoTikTokSubtitles = (
  text: string,
  startSec: number,
  durationSec: number,
  segmentId: string,
  baseId: string
): SplitSubtitleCue[] => {
  if (!text || !text.trim()) return [];

  const cleanText = text.trim().replace(/\s+/g, " ");

  // Check if the text is predominantly CJK (no spaces, or very few)
  const isCJK =
    /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟᄀ-ᇿ㄰-㆏가-힯]/.test(
      cleanText
    );

  let units: string[] = [];
  if (isCJK) {
    units = Array.from(cleanText).filter((c) => c !== " ");
  } else {
    units = cleanText.split(" ");
  }

  if (units.length === 0) return [];

  // Target: 2 to 3 words or characters per subtitle cue (TikTok style is very dynamic)
  const maxUnits = 3;
  const groups: string[][] = [];

  for (let i = 0; i < units.length; i += maxUnits) {
    groups.push(units.slice(i, i + maxUnits));
  }

  // If we have more than one group, and the last group has only 1 unit,
  // merge it into the previous group so we don't have a single word/character hanging.
  if (groups.length > 1 && groups[groups.length - 1].length === 1) {
    const lastGroup = groups.pop();
    if (lastGroup) {
      groups[groups.length - 1].push(...lastGroup);
    }
  }

  const totalUnits = units.length;
  let elapsed = 0;

  return groups.map((grp, idx) => {
    const phrase = isCJK ? grp.join("") : grp.join(" ");
    const phraseUnitsCount = grp.length;

    // Proportional start and duration
    const chunkStart = startSec + (elapsed / totalUnits) * durationSec;
    const chunkDuration = (phraseUnitsCount / totalUnits) * durationSec;

    elapsed += phraseUnitsCount;

    return {
      id: `${baseId}_part_${idx + 1}`,
      start_sec: Number(chunkStart.toFixed(3)),
      duration_sec: Number(chunkDuration.toFixed(3)),
      text: phrase,
      segment_id: segmentId,
    };
  });
};

export const formatSrtTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
};

export const generateSrt = (subtitles: SubtitleCue[]): string => {
  return subtitles
    .map((sub, idx) => {
      const startSec = Number(sub.start_sec) || 0;
      const durationSec = Number(sub.duration_sec) || 5;
      const start = formatSrtTime(startSec);
      const end = formatSrtTime(startSec + durationSec);
      return `${idx + 1}\n${start} --> ${end}\n${sub.text || ""}\n`;
    })
    .join("\n");
};

export const generateAss = (
  subtitles: SubtitleCue[],
  resWidth: number,
  resHeight: number,
  styleParams: AssStyleParams
): string => {
  const refHeight = REF_HEIGHT;
  const refWidth = Math.round(refHeight * (resWidth / resHeight));
  const assFont = getAssFontName(styleParams.fontName);
  const textColor = cssHexToAss(normalizeColor(styleParams.textColor, "#FFFFFF"));
  const strokeColor = cssHexToAss(normalizeColor(styleParams.strokeColor, "#000000"));

  const bg = resolveBackgroundColors(styleParams.hasBg, styleParams.subtitleBgStyle);
  const layout = resolveLayoutFractions(styleParams.position, styleParams.customPosition);
  const alignment = layout.alignment;
  const marginV = Math.round(layout.marginVFrac * refHeight);
  const marginLR = Math.round(0.07 * refWidth);

  const animTags = buildAnimTags(styleParams.subtitleAnimation);

  const isBold =
    styleParams.fontName && styleParams.fontName.toLowerCase().includes("bold") ? -1 : 0;

  let out = `[Script Info]
ScriptType: v4.00+
PlayResX: ${refWidth}
PlayResY: ${refHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
`;

  const outlineVal = styleParams.strokeWidth !== undefined ? styleParams.strokeWidth : 1.5;
  if (bg.enabled) {
    // BgStyle draws the vector box; alignment 5 so it scales/rotates from its center
    out += `Style: BgStyle,${assFont},${styleParams.fontSize},&H${bg.alpha}${bg.color},&H00000000,&HFF000000,&HFF000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1\n`;
  }
  out += `Style: Default,${assFont},${styleParams.fontSize},&H00${textColor},&H00000000,&H00${strokeColor},&HFF000000,${isBold},0,0,0,100,100,0,0,1,${outlineVal.toFixed(1)},0,${alignment},${marginLR},${marginLR},${marginV},1\n`;

  out += `
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  for (const sub of subtitles) {
    const startSec = Number(sub.start_sec) || 0;
    const durationSec = Number(sub.duration_sec) || 5;
    const start = formatAssTime(startSec);
    const end = formatAssTime(startSec + durationSec);
    const text = (sub.text || "").replace(/\\n/g, "\\N").replace(/\n/g, "\\N");

    const centerX = refWidth / 2;
    let centerY = refHeight - marginV;
    if (alignment === 8) {
      centerY = marginV;
    } else if (alignment === 5) {
      centerY = refHeight / 2;
    }

    if (bg.enabled) {
      const lines = text.split(/\\N/);
      let maxLineWidth = 0;
      for (const line of lines) {
        const w = estimateLineWidth(line, styleParams.fontSize);
        if (w > maxLineWidth) maxLineWidth = w;
      }

      const paddingX = styleParams.fontSize * 0.75;
      const paddingY = styleParams.fontSize * 0.35;
      const boxWidth = maxLineWidth + paddingX;
      const textHeight = lines.length * styleParams.fontSize * 1.15;
      const boxHeight = textHeight + paddingY;
      const radius =
        styleParams.roundedBackground === true
          ? Math.min(boxHeight / 2, styleParams.fontSize * 0.35)
          : Math.round(styleParams.fontSize * 0.08);

      let boxY = refHeight - marginV - boxHeight;
      if (alignment === 8) {
        boxY = marginV;
      } else if (alignment === 5) {
        boxY = refHeight / 2 - boxHeight / 2;
      }

      const boxX = centerX - boxWidth / 2;
      const textY = boxY + paddingY / 2;
      const pathStr = getRoundedRectPath(boxWidth, boxHeight, radius);

      // Box on layer 0 anchored top-left (\an7); text on layer 1 anchored top-center (\an8)
      out += `Dialogue: 0,${start},${end},BgStyle,,0,0,0,,{\\an7\\pos(${boxX.toFixed(1)},${boxY.toFixed(1)})${animTags}\\p1}${pathStr}{\\p0}\n`;
      out += `Dialogue: 1,${start},${end},Default,,0,0,0,,{\\an8\\pos(${centerX},${textY.toFixed(1)})${animTags}}${text}\n`;
    } else {
      out += `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an${alignment}\\pos(${centerX},${centerY.toFixed(1)})${animTags}}${text}\n`;
    }
  }

  return out;
};
