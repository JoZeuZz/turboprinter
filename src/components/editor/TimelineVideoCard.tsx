import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Video } from "lucide-react";
import type { TimelineItem } from "../../api/types";

interface TimelineVideoCardProps {
  item: TimelineItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  widthPx?: number;
}

const MIN_WIDTH_PX = 56;
const DEFAULT_WIDTH_PX = 96;

export function TimelineVideoCard({
  item,
  isSelected,
  onSelect,
  widthPx = DEFAULT_WIDTH_PX,
}: TimelineVideoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const [imgError, setImgError] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: `${Math.max(widthPx, MIN_WIDTH_PX)}px`,
  };

  const isOutro = item.id === "clip_outro" || item.keywords?.includes("outro") || item.asset_url?.includes("outro");

  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onSelect(item.id)}
      data-testid={`clip-${item.id}`}
      className={`group relative h-14 shrink-0 overflow-hidden rounded border transition-all ${
        isOutro
          ? isSelected
            ? "border-amber-400 bg-amber-500/20 ring-1 ring-amber-400"
            : "border-amber-500/60 bg-amber-950/20 hover:border-amber-400"
          : isSelected
          ? "border-accent bg-accent/20 ring-1 ring-accent shadow-[0_0_0_1px_rgba(99,102,241,0.4)]"
          : "border-border bg-surface hover:border-accent/50 hover:brightness-110"
      }`}
    >
      {isOutro && (
        <span className="absolute top-0.5 left-0.5 z-10 bg-amber-500/90 text-black text-[8px] font-extrabold px-1 rounded shadow">
          🎬 OUTRO
        </span>
      )}
      {item.thumbnail_url && !imgError ? (
        <img
          src={item.thumbnail_url}
          alt={item.text ?? item.id}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover"
        />
      ) : item.asset_url ? (
        <video
          src={item.asset_url}
          className="h-full w-full object-cover pointer-events-none"
          muted
          preload="metadata"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center bg-muted/10 px-1 text-center text-[9px] text-muted-foreground truncate">
          <Video className="h-4 w-4 mb-0.5 opacity-60 text-accent shrink-0" />
          <span className="truncate w-full font-mono">{item.text ?? item.id}</span>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/70 to-transparent" />
      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[9px] text-white font-mono">
        {item.duration_sec.toFixed(1)}s
      </span>
    </button>
  );
}
