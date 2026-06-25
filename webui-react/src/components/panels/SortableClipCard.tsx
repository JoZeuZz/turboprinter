// webui-react/src/components/panels/SortableClipCard.tsx
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Play, X, GripVertical } from "lucide-react";
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clip.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-excluded={excluded}
      className={`relative rounded-lg border border-border bg-surface-2 overflow-hidden flex flex-col ${
        excluded ? "opacity-40" : ""
      }`}
    >
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
      <div className="aspect-video bg-surface flex items-center justify-center relative">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.text ?? clip.id}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-xs text-muted px-2 text-center truncate">
            {clip.text ?? clip.id}
          </div>
        )}

        {/* Play overlay */}
        <button
          title="Preview"
          onClick={() => onPreview(clip)}
          className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/50 transition-colors group"
        >
          <Play className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs text-muted">{clip.duration_sec.toFixed(1)}s</span>
        <button
          title={excluded ? "Incluir" : "Excluir"}
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
