import { useState, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../store/useProjectStore";
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
  sampleText?: string | null;
}

const DEFAULT_SAMPLE =
  "Este es un ejemplo de subtitulo para previsualizar el estilo.";

function splitIntoSubtitles(text: string): string[] {
  if (!text) return [];
  // Split into sentences, clauses, or lines based on punctuation and line breaks
  const segments = text
    .split(/(?<=[.?!,])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  
  const chunks: string[] = [];
  for (const seg of segments) {
    const words = seg.split(/\s+/);
    if (words.length <= 6) {
      chunks.push(seg);
    } else {
      for (let i = 0; i < words.length; i += 6) {
        chunks.push(words.slice(i, i + 6).join(" "));
      }
    }
  }
  return chunks.filter(c => c.trim().length > 0);
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const projectStore = useProjectStore();
  const subtitleTrack = projectStore.project?.tracks.find((t) => t.type === "subtitle");
  const subtitleItems = subtitleTrack?.items ?? [];

  // Determine standard source text or fallback text
  const sourceText = sampleText?.trim() || DEFAULT_SAMPLE;

  // Generate subtitle array: either actual project subtitle items or sliced chunks from source text
  const subtitleTexts = subtitleItems.length > 0
    ? subtitleItems.map((item) => item.text || "").filter(Boolean)
    : splitIntoSubtitles(sourceText);

  // Playback timer to cycle active subtitle
  useEffect(() => {
    if (!isPlaying || subtitleTexts.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % subtitleTexts.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isPlaying, subtitleTexts.length]);

  // Handle resets or script edits
  useEffect(() => {
    setCurrentIndex(0);
  }, [sampleText, subtitleTexts.length]);

  const activeText = subtitleTexts[currentIndex] || subtitleTexts[0] || DEFAULT_SAMPLE;

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
              {activeText}
            </span>
          </div>
        </div>
      </div>

      {subtitleTexts.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground hover:bg-surface/80 hover:text-foreground transition-all cursor-pointer"
            onClick={() => setCurrentIndex((prev) => (prev - 1 + subtitleTexts.length) % subtitleTexts.length)}
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all cursor-pointer ${
              isPlaying 
                ? "bg-accent text-white hover:bg-accent-hover" 
                : "border border-border bg-surface text-muted-foreground hover:bg-surface/80 hover:text-foreground"
            }`}
            onClick={() => setIsPlaying(!isPlaying)}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground hover:bg-surface/80 hover:text-foreground transition-all cursor-pointer"
            onClick={() => setCurrentIndex((prev) => (prev + 1) % subtitleTexts.length)}
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </aside>
  );
}

