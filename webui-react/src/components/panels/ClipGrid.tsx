// webui-react/src/components/panels/ClipGrid.tsx
import { X, Play } from "lucide-react";
import type { TimelineItem } from "../../api/types";

interface ClipGridProps {
  clips: TimelineItem[];
  excluded: string[];
  onExclude: (clipId: string) => void;
}

export function ClipGrid({ clips, excluded, onExclude }: ClipGridProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {clips.map((clip, idx) => {
        const isExcluded = excluded.includes(clip.id);
        return (
          <div
            key={clip.id}
            data-excluded={isExcluded}
            className={`group relative rounded-lg overflow-hidden border transition-opacity ${
              isExcluded
                ? "border-border opacity-40"
                : "border-border hover:border-accent"
            }`}
          >
            {/* Thumbnail or fallback */}
            <div
              className="aspect-[9/16] flex items-center justify-center bg-surface-elevated text-xs text-muted font-mono"
              style={{
                background: `hsl(${(idx * 47) % 360}, 20%, 18%)`,
              }}
            >
              {clip.thumbnail_url ? (
                <img
                  src={clip.thumbnail_url}
                  alt={`clip ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>#{idx + 1}</span>
              )}
            </div>

            {/* Overlay controls */}
            <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <button className="rounded-full bg-white/20 p-1.5 hover:bg-white/40">
                <Play className="h-3 w-3 text-white" />
              </button>
              <button
                title="Exclude clip"
                onClick={() => onExclude(clip.id)}
                className="rounded-full bg-red-500/60 p-1.5 hover:bg-red-500"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>

            {/* Duration badge */}
            <div className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[10px] text-white font-mono">
              {clip.duration_sec.toFixed(1)}s
            </div>
          </div>
        );
      })}
    </div>
  );
}
