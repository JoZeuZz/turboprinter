import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TimelineItem } from "../../api/types";

interface TimelineVideoCardProps {
  item: TimelineItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export function TimelineVideoCard({ item, isSelected, onSelect }: TimelineVideoCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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
      className={`relative h-14 w-24 shrink-0 overflow-hidden rounded border transition-colors ${
        isSelected ? "border-accent bg-accent/20" : "border-border bg-surface hover:border-accent/50"
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
      <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 text-[9px] text-white">
        {item.duration_sec.toFixed(1)}s
      </span>
    </button>
  );
}
