// webui-react/src/components/editor/ClipInspector.tsx
import { useEffect, useState } from "react";
import { Trash2, Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../api/types";

interface ClipInspectorProps {
  clip: TimelineItem | null;
  onTrimChange: (id: string, start: number, end: number | null) => void;
  onRemove: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

function TrimSlider({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] uppercase tracking-widest text-muted">{label}</label>
        <span className="text-xs text-foreground tabular-nums">{local.toFixed(1)}s</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.1}
        value={local}
        onChange={(e) => setLocal(parseFloat(e.target.value))}
        onMouseUp={() => onCommit(local)}
        onTouchEnd={() => onCommit(local)}
        onKeyUp={() => onCommit(local)}
        className="w-full h-1.5 rounded-full appearance-none bg-border cursor-pointer accent-accent"
      />
    </div>
  );
}

export function ClipInspector({ clip, onTrimChange, onRemove, onDuplicate }: ClipInspectorProps) {
  const { t } = useTranslation();

  if (!clip) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted p-4 text-center">
        {t("editor.selectClip")}
      </div>
    );
  }

  const trimStart = clip.trim_start_sec ?? 0;
  const trimEnd = clip.trim_end_sec ?? clip.duration_sec;

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1">{t("editor.clip")}</p>
        <p className="text-sm font-mono text-foreground truncate">{clip.text || clip.id}</p>
      </div>

      <div className="flex gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
            {t("editor.duration")}
          </p>
          <p className="text-sm text-foreground tabular-nums">{clip.duration_sec.toFixed(2)}s</p>
        </div>
        {clip.provider && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
              {t("editor.source")}
            </p>
            <p className="text-sm text-foreground capitalize">{clip.provider}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 pt-1 border-t border-border">
        <TrimSlider
          label={t("editor.trimStart")}
          value={trimStart}
          min={0}
          max={Math.max(clip.duration_sec - 0.5, 0)}
          onCommit={(v) => onTrimChange(clip.id, v, clip.trim_end_sec ?? null)}
        />
        <TrimSlider
          label={t("editor.trimEnd")}
          value={trimEnd}
          min={0.5}
          max={clip.duration_sec}
          onCommit={(v) => onTrimChange(clip.id, clip.trim_start_sec ?? 0, v)}
        />
      </div>

      {clip.keywords && clip.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {clip.keywords.map((kw) => (
            <span
              key={kw}
              className="flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted"
            >
              <Layers className="h-2.5 w-2.5" />
              {kw}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-border">
        {onDuplicate && (
          <button
            onClick={() => onDuplicate(clip.id)}
            className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-surface-2 transition-colors"
          >
            <Layers className="h-3.5 w-3.5" />
            {t("common.duplicate")}
          </button>
        )}
        <button
          onClick={() => onRemove(clip.id)}
          className="flex items-center gap-2 rounded-md border border-red-800/50 px-3 py-1.5 text-xs text-red-400 hover:border-red-500 hover:bg-red-950/30 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t("common.delete")}
        </button>
      </div>
    </div>
  );
}
