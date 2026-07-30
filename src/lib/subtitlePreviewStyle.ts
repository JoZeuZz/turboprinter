import {
  backgroundSpecToCss,
  normalizeColor,
  resolveBackgroundSpec,
  resolveLayoutFractions,
} from "./subtitleLayout";

export interface SubtitleStyleInput {
  fontSize: number;
  strokeWidth: number;
  position: string;
  customPosition?: number;
  textColor?: string | null;
  strokeColor?: string | null;
  backgroundColor?: boolean | string | null;
  roundedBackground?: boolean | null;
  subtitleBgStyle?: string | null;
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

// 9:16 render reference (generateAss REF_HEIGHT).
export const RENDER_WIDTH = 1080;
export const RENDER_HEIGHT = 1920;
// Preview box reference: max-w-[210px] at aspect 9:16 -> 210 * 16/9 ≈ 373.
export const PREVIEW_DIMS: PreviewDims = { width: 210, height: 373 };

function resolveBackground(
  backgroundColor: SubtitleStyleInput["backgroundColor"],
  subtitleBgStyle: string | null | undefined,
  rounded: boolean | null | undefined
): PreviewStyle["background"] {
  // CSS adapter over the shared engine: same spec the ASS render uses.
  const spec = resolveBackgroundSpec(backgroundColor ?? false, subtitleBgStyle ?? undefined);
  const css = backgroundSpecToCss(spec);
  if (!css) return null;
  return { color: css, rounded: Boolean(rounded) };
}

function resolvePosition(
  position: string,
  customPosition: number | undefined
): PreviewStyle["position"] {
  // Delegates to the shared layout so the preview always matches the ASS render.
  const layout = resolveLayoutFractions(position, customPosition);
  return { anchor: layout.anchor, offsetPct: layout.offsetPct };
}

export function resolvePreviewStyle(style: SubtitleStyleInput, dims: PreviewDims): PreviewStyle {
  const scale = dims.height / RENDER_HEIGHT;
  const textColor = normalizeColor(style.textColor, "#FFFFFF");
  const strokeColor = normalizeColor(style.strokeColor, "#000000");
  // The render applies strokeWidth as-is (generateAss outlineVal); mirror that.
  const renderStroke = style.strokeWidth > 0 ? style.strokeWidth : 0;
  return {
    fontSizePx: style.fontSize * scale,
    strokePx: renderStroke * scale,
    color: textColor,
    strokeColor,
    position: resolvePosition(style.position, style.customPosition),
    background: resolveBackground(style.backgroundColor, style.subtitleBgStyle, style.roundedBackground),
  };
}
