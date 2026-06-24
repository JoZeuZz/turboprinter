// webui-react/src/components/editor/Timeline.tsx
import type { TimelineItem } from "../../api/types";

interface TimelineProps {
  items: TimelineItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function Timeline({ items, selectedId, onSelect }: TimelineProps) {
  const totalDuration = items.reduce((s, c) => s + c.duration_sec, 0) || 1;

  return (
    <div className="border-t border-border bg-base">
      {/* Waveform placeholder */}
      <div className="h-8 flex items-center px-3 gap-px">
        {Array.from({ length: 60 }).map((_, i) => (
          <div
            key={i}
            className="bg-accent/30 rounded-sm flex-1"
            style={{ height: `${20 + Math.sin(i * 0.4) * 12}px` }}
          />
        ))}
      </div>

      {/* Clip track */}
      <div className="relative h-14 flex items-center px-3 gap-1 overflow-x-auto">
        {items.map((item, idx) => {
          const widthPct = (item.duration_sec / totalDuration) * 100;
          const isSelected = item.id === selectedId;
          return (
            <button
              key={item.id}
              data-testid={`clip-${item.id}`}
              onClick={() => onSelect(item.id)}
              style={{ width: `${widthPct}%`, minWidth: "40px" }}
              className={`h-10 shrink-0 rounded flex items-center justify-center text-[10px] font-mono border transition-colors cursor-pointer ${
                isSelected
                  ? "border-accent bg-accent/20 text-accent"
                  : "border-border bg-surface text-muted hover:border-accent/50"
              }`}
            >
              #{idx + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}
