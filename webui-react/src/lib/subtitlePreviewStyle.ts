export interface SubtitleStyleInput {
  fontSize: number;
  strokeWidth: number;
  position: string;
  customPosition?: number;
  textColor?: string | null;
  strokeColor?: string | null;
  backgroundColor?: boolean | string | null;
  roundedBackground?: boolean | null;
}

export interface PreviewDims {
  width: number;
  height: number;
}

export interface PreviewStyle {
  fontSizePx: number;
  strokePx: number;
  color: string;
  strokeColor: string;
  position: { anchor: "top" | "bottom" | "center"; offsetPct: number };
  background: { color: string; rounded: boolean } | null;
}

// 9:16 render reference (VideoAspect.portrait.to_resolution()).
export const RENDER_WIDTH = 1080;
export const RENDER_HEIGHT = 1920;
// Preview box reference: max-w-[210px] at aspect 9:16 -> 210 * 16/9 ≈ 373.
export const PREVIEW_DIMS: PreviewDims = { width: 210, height: 373 };

// Mirrors app/services/video.py::_resolve_render_stroke_width (integer, font-relative).
function renderStrokeWidth(strokeWidth: number, fontSize: number, hasColor: boolean): number {
  if (!(strokeWidth > 0) || !hasColor) return 0;
  const proportional = Math.max(1, Math.round(fontSize * 0.06));
  return Math.max(Math.round(strokeWidth), proportional);
}

function resolveBackground(
  backgroundColor: SubtitleStyleInput["backgroundColor"],
  rounded: boolean | null | undefined
): PreviewStyle["background"] {
  // Mirrors the render: bool true -> "#000000"; a real color string -> passthrough;
  // false / null / undefined / "" -> no background (downstream `bool(bg_color)` is false).
  if (backgroundColor === true) return { color: "#000000", rounded: Boolean(rounded) };
  if (typeof backgroundColor === "string" && backgroundColor.trim()) {
    return { color: backgroundColor, rounded: Boolean(rounded) };
  }
  return null;
}

function resolvePosition(
  position: string,
  customPosition: number | undefined
): PreviewStyle["position"] {
  if (position === "top") return { anchor: "top", offsetPct: 5 };
  if (position === "center") return { anchor: "center", offsetPct: 50 };
  if (position === "custom") return { anchor: "top", offsetPct: customPosition ?? 70 };
  return { anchor: "bottom", offsetPct: 5 };
}

export function resolvePreviewStyle(style: SubtitleStyleInput, dims: PreviewDims): PreviewStyle {
  const scale = dims.height / RENDER_HEIGHT;
  // Normalize like the render's _normalize_render_color: empty/blank -> fallback (always a valid color).
  const textColor = style.textColor?.trim() || "#FFFFFF";
  const strokeColor = style.strokeColor?.trim() || "#000000";
  const renderStroke = renderStrokeWidth(style.strokeWidth, style.fontSize, Boolean(strokeColor));
  return {
    fontSizePx: style.fontSize * scale,
    strokePx: renderStroke * scale,
    color: textColor,
    strokeColor,
    position: resolvePosition(style.position, style.customPosition),
    background: resolveBackground(style.backgroundColor, style.roundedBackground),
  };
}
