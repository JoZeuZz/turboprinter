// webui-react/src/components/panels/GeneratingPanel.tsx
import { useEffect, useState } from "react";
import { Check, Loader2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED } from "../../api/types";

const STEPS = [
  { label: "Script ready", threshold: 5 },
  { label: "Audio (TTS) synthesized", threshold: 20 },
  { label: "Word timestamps extracted", threshold: 30 },
  { label: "Downloading Clips", threshold: 70 },
  { label: "Assembling video", threshold: 90 },
  { label: "Burning subtitles", threshold: 99 },
];

export function GeneratingPanel() {
  const { taskStatus, error, setPanel } = useProjectWorkspaceStore();
  const [logsOpen, setLogsOpen] = useState(false);
  const progress = taskStatus?.progress ?? 0;

  // Auto-transition on completion
  useEffect(() => {
    if (taskStatus?.state === TASK_STATE_COMPLETE) {
      setPanel("done");
    }
  }, [taskStatus?.state, setPanel]);

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-8">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-sm font-semibold text-foreground">Generating your video</h2>

        {error && (
          <div className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 space-y-2">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => setPanel("config")}
              className="text-xs text-red-300 underline hover:text-red-100"
            >
              Try Again
            </button>
          </div>
        )}

        {taskStatus?.state === TASK_STATE_FAILED && !error && (
          <div className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 space-y-2">
            <p className="text-xs text-red-400">Task failed. Please try again.</p>
            <button
              onClick={() => setPanel("config")}
              className="text-xs text-red-300 underline hover:text-red-100"
            >
              Try Again
            </button>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="space-y-2">
          {STEPS.map(({ label, threshold }) => {
            const done = progress >= threshold;
            const active = !done && progress >= threshold - 30 && progress < threshold;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                {done ? (
                  <Check className="h-4 w-4 shrink-0 text-green-400" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-border" />
                )}
                <span
                  className={
                    done
                      ? "text-muted line-through"
                      : active
                      ? "text-foreground"
                      : "text-muted"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        <button
          onClick={() => setLogsOpen((o) => !o)}
          className="flex items-center gap-1 text-xs text-muted hover:text-foreground"
        >
          {logsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {logsOpen ? "Hide logs" : "Show logs"}
        </button>
        {logsOpen && (
          <div className="rounded-md border border-border bg-base p-3 font-mono text-xs text-muted h-28 overflow-y-auto">
            <p>Polling task… progress {progress}%</p>
          </div>
        )}
      </div>
    </div>
  );
}
