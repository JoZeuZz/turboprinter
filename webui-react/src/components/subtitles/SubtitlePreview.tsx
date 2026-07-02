import { useTranslation } from "react-i18next";
import { getSubtitleFontFamily } from "./SubtitleFontGallery";

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

function resolveBackgroundColor(value: SubtitlePreviewProps["textBackgroundColor"]) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return value === false ? "transparent" : "rgba(0, 0, 0, 0.72)";
}

function resolvePosition(position: string | null | undefined, customPosition = 70) {
  if (position === "top") {
    return { top: "12%", transform: "translateX(-50%)" };
  }

  if (position === "center") {
    return { top: "50%", transform: "translate(-50%, -50%)" };
  }

  if (position === "custom") {
    return { top: `${customPosition}%`, transform: "translate(-50%, -50%)" };
  }

  return { bottom: "12%", transform: "translateX(-50%)" };
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
  sampleText,
}: SubtitlePreviewProps) {
  const { t } = useTranslation();
  const resolvedPosition = resolvePosition(position, customPosition ?? 70);
  const previewFontSize = Math.max(16, Math.min(34, (fontSize ?? 60) * 0.44));
  const previewStroke = Math.max(0, Math.min(2.5, strokeWidth ?? 1.5));
  const backgroundColor = resolveBackgroundColor(textBackgroundColor);
  const hasBackground = textBackgroundColor !== false;
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
          style={resolvedPosition}
        >
          <div
            className={`inline-block max-w-full px-3 py-1.5 leading-tight ${
              roundedBackground ? "rounded-xl" : "rounded-sm"
            }`}
            style={{
              backgroundColor: hasBackground ? backgroundColor : "transparent",
            }}
          >
            <span
              className="block break-words font-semibold"
              style={{
                color: textColor ?? "#FFFFFF",
                fontFamily: `"${getSubtitleFontFamily(fontName)}", sans-serif`,
                fontSize: `${previewFontSize}px`,
                WebkitTextStroke: `${previewStroke}px ${strokeColor ?? "#000000"}`,
                textShadow:
                  previewStroke > 0
                    ? `0 1px 2px ${strokeColor ?? "#000000"}, 0 0 8px rgba(0,0,0,0.45)`
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
