import { useTranslation } from "react-i18next";
import { getSubtitleFontFamily } from "./SubtitleFontGallery";
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
  sampleText?: string | null;
}

const DEFAULT_SAMPLE =
  "Este es un ejemplo de subtitulo para previsualizar el estilo.";

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
          <div
            className={`inline-block max-w-full px-3 py-1.5 leading-tight ${
              previewStyle.background?.rounded ? "rounded-xl" : "rounded-sm"
            }`}
            style={{ backgroundColor: previewStyle.background ? previewStyle.background.color : "transparent" }}
          >
            <span
              className="block break-words font-semibold"
              style={{
                color: previewStyle.color,
                fontFamily: getSubtitleFontFamily(fontName),
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
          </div>
        </div>
      </div>
    </aside>
  );
}
