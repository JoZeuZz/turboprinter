// webui-react/src/components/panels/ProgressArea.tsx
import { useTaskStore } from "../../store/useTaskStore";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED } from "../../api/types";

export function ProgressArea() {
  const { status, isRunning, error } = useTaskStore();

  if (!isRunning && !status && !error) return null;

  return (
    <div className="rounded-md border border-border bg-surface p-4 flex flex-col gap-3">
      {error && (
        <p className="text-sm text-red-400">Error: {error}</p>
      )}
      {isRunning && status && status.state !== TASK_STATE_COMPLETE && status.state !== TASK_STATE_FAILED && (
        <>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Generating…</span>
            <span>{status.progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-300 rounded-full"
              style={{ width: `${status.progress}%` }}
            />
          </div>
        </>
      )}
      {status?.state === TASK_STATE_COMPLETE && (
        <p className="text-sm text-green-400">Done! Videos ready below.</p>
      )}
    </div>
  );
}
