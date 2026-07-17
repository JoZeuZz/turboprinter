import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { getSubtitleFontFamily, getSubtitleFontWeight } from "./SubtitleFontGallery";
import { resolvePreviewStyle, PREVIEW_DIMS } from "../../lib/subtitlePreviewStyle";

interface SubtitlePreviewProps {
  enabled: boolean;
  position?: string | null;
  customPosition?: number | null;
  fontName?: string | null;
  fontSize?: number | null;
  textColor?: string | null;
  strokeColor?: string | null;
  strokeWidth?: number | null;
  textBackgroundColor?: boolean | string | null;
  roundedBackground?: boolean | null;
  subtitleBgStyle?: "solid" | "translucent" | "blur" | null;
  subtitleAnimation?: "none" | "pop" | "fade" | "rotate" | null;
  sampleText?: string | null;
}

const DEFAULT_SAMPLE =
  "Este es un ejemplo de subtítulo para previsualizar el estilo.";

function getTranslucentColor(hex: string): string {
  if (!hex || !hex.startsWith("#")) return hex;
  const clean = hex.substring(1);
  if (clean.length === 3) {
    const r = clean[0], g = clean[1], b = clean[2];
    return `rgba(${parseInt(r+r, 16)}, ${parseInt(g+g, 16)}, ${parseInt(b+b, 16)}, 0.5)`;
  }
  if (clean.length === 6) {
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `rgba(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0.5)`;
  }
  return hex;
}

export function SubtitlePreview({
  enabled,
  position,
  customPosition,
  fontName,
  fontSize,
  textColor,
  strokeColor,
  strokeWidth,
  textBackgroundColor,
  roundedBackground,
  subtitleBgStyle,
  subtitleAnimation,
  sampleText,
}: SubtitlePreviewProps) {
  const { t } = useTranslation();

  const previewStyle = resolvePreviewStyle(
    {
      fontSize: fontSize ?? 60,
      strokeWidth: strokeWidth ?? 1.5,
      position: position ?? "bottom",
      customPosition: customPosition ?? undefined,
      textColor: textColor ?? null,
      strokeColor: strokeColor ?? null,
      backgroundColor: textBackgroundColor ?? true,
      roundedBackground: roundedBackground ?? null,
    },
    PREVIEW_DIMS
  );

  const positionStyle =
    previewStyle.position.anchor === "bottom"
      ? { bottom: `${previewStyle.position.offsetPct}%`, transform: "translateX(-50%)" }
      : previewStyle.position.anchor === "center"
        ? { top: "50%", transform: "translate(-50%, -50%)" }
        : { top: `${previewStyle.position.offsetPct}%`, transform: "translateX(-50%)" };

  const text = sampleText?.trim() || DEFAULT_SAMPLE;

  let finalBgColor = "transparent";
  const bgStyle = previewStyle.background;
  if (bgStyle) {
    if (subtitleBgStyle === "translucent") {
      finalBgColor = getTranslucentColor(bgStyle.color);
    } else if (subtitleBgStyle === "blur") {
      finalBgColor = "rgba(255, 255, 255, 0.25)";
    } else {
      finalBgColor = bgStyle.color;
    }
  }

  const animType = subtitleAnimation ?? "pop";
  let motionProps = {};
  if (enabled) {
    if (animType === "pop") {
      motionProps = {
        initial: { scale: 0.8 },
        animate: { scale: [0.8, 1.12, 1.0] },
        transition: { duration: 0.18, times: [0, 0.5, 1], ease: "easeOut" },
      };
    } else if (animType === "fade") {
      motionProps = {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.15, ease: "easeOut" },
      };
    } else if (animType === "rotate") {
      motionProps = {
        initial: { scale: 0.8, rotate: -3.5 },
        animate: { scale: [0.8, 1.12, 1.0], rotate: [-3.5, 2, 0] },
        transition: { duration: 0.2, times: [0, 0.5, 1], ease: "easeOut" },
      };
    }
  }

  return (
    <aside className="rounded-xl border border-border bg-base p-3 lg:sticky lg:top-2">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold text-foreground">{t("subtitles.preview")}</h3>
          <p className="mt-1 text-[11px] text-foreground/55">
            {t("subtitles.previewApprox")}
          </p>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-foreground/60">
          9:16
        </span>
      </div>

      <div className="relative mx-auto aspect-[9/16] w-full max-w-[210px] overflow-hidden rounded-lg border border-border bg-surface shadow-inner">
        <img
          src="/assets/background.jpg"
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/35" />

        <div
          className={`absolute left-1/2 w-[86%] text-center transition-opacity ${
            enabled ? "opacity-100" : "opacity-35"
          }`}
          style={positionStyle}
        >
          <motion.div
            key={`${text}-${animType}-${textColor}-${fontName}-${fontSize}-${strokeColor}-${strokeWidth}-${roundedBackground}-${subtitleBgStyle}`}
            className={`inline-block max-w-full px-3 py-1.5 leading-tight transition-all ${
              previewStyle.background?.rounded ? "rounded-xl" : "rounded-sm"
            } ${subtitleBgStyle === "blur" ? "backdrop-blur-md border border-white/20" : ""}`}
            style={{ backgroundColor: finalBgColor }}
            {...motionProps}
          >
            <span
              className="block break-words"
              style={{
                color: previewStyle.color,
                fontFamily: getSubtitleFontFamily(fontName),
                fontWeight: getSubtitleFontWeight(fontName),
                fontSize: `${previewStyle.fontSizePx}px`,
                textShadow:
                  previewStyle.strokePx > 0
                    ? `-${previewStyle.strokePx}px -${previewStyle.strokePx}px 0 ${previewStyle.strokeColor},
                       ${previewStyle.strokePx}px -${previewStyle.strokePx}px 0 ${previewStyle.strokeColor},
                       -${previewStyle.strokePx}px ${previewStyle.strokePx}px 0 ${previewStyle.strokeColor},
                       ${previewStyle.strokePx}px ${previewStyle.strokePx}px 0 ${previewStyle.strokeColor},
                       0px -${previewStyle.strokePx}px 0 ${previewStyle.strokeColor},
                       0px ${previewStyle.strokePx}px 0 ${previewStyle.strokeColor},
                       -${previewStyle.strokePx}px 0px 0 ${previewStyle.strokeColor},
                       ${previewStyle.strokePx}px 0px 0 ${previewStyle.strokeColor},
                       0 1px 4px rgba(0,0,0,0.5)`
                    : "0 1px 2px rgba(0,0,0,0.45)",
              }}
            >
              {text}
            </span>
          </motion.div>
        </div>
      </div>
    </aside>
  );
}

