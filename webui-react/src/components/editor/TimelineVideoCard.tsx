import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    width: `${Math.max(widthPx, MIN_WIDTH_PX)}px`,
  };

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
        isSelected
          ? "border-accent bg-accent/20 ring-1 ring-accent shadow-[0_0_0_1px_rgba(99,102,241,0.4)]"
          : "border-border bg-surface hover:border-accent/50 hover:brightness-110"
      }`}
    >
      {item.thumbnail_url ? (
        <img
          src={item.thumbnail_url}
          alt={item.text ?? item.id}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-muted truncate">
          {item.text ?? item.id}
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/70 to-transparent" />
      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[9px] text-white">
        {item.duration_sec.toFixed(1)}s
      </span>
    </button>
  );
}
