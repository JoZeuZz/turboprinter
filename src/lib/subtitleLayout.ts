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

export const resolveBackgroundColors = (
  hasBg: boolean | string,
  subtitleBgStyle: string | undefined
): BackgroundColors => {
  const enabled =
    hasBg === true ||
    (typeof hasBg === "string" &&
      Boolean(hasBg.trim()) &&
      hasBg.trim() !== "transparent" &&
      hasBg.trim() !== "none");

  let color = "000000";
  let alpha = "00"; // fully opaque box by default

  if (!enabled) return { enabled: false, color, alpha };

  if (typeof hasBg === "string" && hasBg.trim()) {
    const cleanBg = hasBg.trim();
    if (cleanBg.startsWith("#")) {
      color = cssHexToAss(cleanBg);
      if (cleanBg.length === 9) {
        const cssAlphaInt = parseInt(cleanBg.substring(7, 9), 16);
        alpha = (255 - cssAlphaInt).toString(16).padStart(2, "0").toUpperCase();
      }
    } else if (cleanBg.startsWith("rgba")) {
      const match = cleanBg.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, "0");
        const g = parseInt(match[2]).toString(16).padStart(2, "0");
        const b = parseInt(match[3]).toString(16).padStart(2, "0");
        color = `${b}${g}${r}`;
        const a = parseFloat(match[4]);
        alpha = Math.round((1 - a) * 255).toString(16).padStart(2, "0").toUpperCase();
      }
    } else if (cleanBg.startsWith("rgb")) {
      const match = cleanBg.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
      if (match) {
        const r = parseInt(match[1]).toString(16).padStart(2, "0");
        const g = parseInt(match[2]).toString(16).padStart(2, "0");
        const b = parseInt(match[3]).toString(16).padStart(2, "0");
        color = `${b}${g}${r}`;
      }
    }
  }

  if (subtitleBgStyle === "translucent") {
    if (alpha === "00") alpha = "80"; // 50% transparency
  } else if (subtitleBgStyle === "blur") {
    color = "FFFFFF";
    alpha = "C0"; // 25% opacity white box
  } else {
    alpha = "00"; // solid: force opaque
  }

  return { enabled, color, alpha };
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

export const generateAss = (
  subtitles: SubtitleCue[],
  resWidth: number,
  resHeight: number,
  styleParams: AssStyleParams
): string => {
  const refHeight = REF_HEIGHT;
  const refWidth = Math.round(refHeight * (resWidth / resHeight));
  const assFont = getAssFontName(styleParams.fontName);
  const textColor = cssHexToAss(styleParams.textColor);
  const strokeColor = cssHexToAss(styleParams.strokeColor);

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
