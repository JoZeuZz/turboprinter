// webui-react/src/components/panels/SortableClipCard.tsx
import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Play, X, GripVertical, Video } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../api/types";

interface SortableClipCardProps {
  clip: TimelineItem;
  excluded: boolean;
  onExclude: (id: string) => void;
  onPreview: (clip: TimelineItem) => void;
}

export function SortableClipCard({
  clip,
  excluded,
  onExclude,
  onPreview,
}: SortableClipCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clip.id });

  const [imgError, setImgError] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const isOutro = clip.id === "clip_outro" || clip.keywords?.includes("outro") || clip.asset_url?.includes("outro");

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-excluded={excluded}
      className={`relative rounded-lg border bg-surface-2 overflow-hidden flex flex-col ${
        isOutro ? "border-amber-500/50 shadow-sm shadow-amber-500/10" : "border-border"
      } ${excluded ? "opacity-40" : ""}`}
    >
      {/* Outro badge */}
      {isOutro && (
        <div className="absolute top-1 right-1 z-10 bg-amber-500/90 text-black text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
          🎬 CIERRE / OUTRO
        </div>
      )}

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-10 cursor-grab active:cursor-grabbing rounded p-0.5 text-muted hover:text-foreground hover:bg-black/40"
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {/* Thumbnail */}
      <div 
        onClick={() => onPreview(clip)}
        className="aspect-video bg-surface flex items-center justify-center relative cursor-pointer group"
      >
        {clip.thumbnail_url && !imgError ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.text ?? clip.id}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (clip.asset_url || clip.source_url) ? (
          <video
            src={clip.asset_url || clip.source_url || undefined}
            className="w-full h-full object-cover pointer-events-none"
            muted
            preload="metadata"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-xs text-muted-foreground px-2 text-center truncate">
            <Video className="h-5 w-5 mb-1 opacity-60 text-accent" />
            <span className="text-[10px] truncate max-w-full font-mono">{clip.text ?? clip.id}</span>
          </div>
        )}

        {/* Play overlay */}
        <div
          title={t("clips.preview")}
          className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/50 transition-colors"
        >
          <Play className="h-8 w-8 text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all drop-shadow" />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-muted">{clip.duration_sec.toFixed(1)}s</span>
        <button
          title={excluded ? t("clips.include") : t("clips.excludeShort")}
          onClick={() => onExclude(clip.id)}
          className={`rounded p-0.5 text-xs transition-colors ${
            excluded
              ? "text-accent hover:text-foreground"
              : "text-muted hover:text-red-400"
          }`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
