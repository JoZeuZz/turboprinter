// webui-react/src/components/editor/ClipInspector.tsx
import { Trash2, RefreshCw } from "lucide-react";
import type { TimelineItem } from "../../api/types";

interface ClipInspectorProps {
  clip: TimelineItem | null;
  onTrimChange: (id: string, start: number, end: number | null) => void;
  onRemove: (id: string) => void;
}

export function ClipInspector({ clip, onTrimChange, onRemove }: ClipInspectorProps) {
  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted p-4 text-center">
        Select a clip on the timeline to inspect it.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Clip</p>
        <p className="text-sm font-mono text-foreground">{clip.id}</p>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">Duration</p>
        <p className="text-sm text-foreground">{clip.duration_sec.toFixed(2)}s</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted block mb-1">
            Trim start (s)
          </label>
          <input
            type="number"
            min={0}
            max={clip.duration_sec - 0.5}
            step={0.1}
            defaultValue={(clip.trim_start_sec ?? 0).toFixed(1)}
            onBlur={(e) =>
              onTrimChange(clip.id, parseFloat(e.target.value), clip.trim_end_sec ?? null)
            }
            className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted block mb-1">
            Trim end (s)
          </label>
          <input
            type="number"
            min={0.5}
            max={clip.duration_sec}
            step={0.1}
            defaultValue={(clip.trim_end_sec ?? clip.duration_sec).toFixed(1)}
            onBlur={(e) =>
              onTrimChange(clip.id, clip.trim_start_sec ?? 0, parseFloat(e.target.value))
            }
            className="w-full h-8 rounded border border-border bg-surface px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        <button
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground hover:border-accent/50 transition-colors"
          title="Replace clip (Phase 3)"
          disabled
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Replace clip
        </button>
        <button
          onClick={() => onRemove(clip.id)}
          className="flex items-center gap-2 rounded-md border border-red-800/50 px-3 py-1.5 text-xs text-red-400 hover:border-red-500 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove
        </button>
      </div>
    </div>
  );
}
