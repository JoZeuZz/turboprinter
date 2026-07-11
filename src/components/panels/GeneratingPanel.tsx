// webui-react/src/components/panels/GeneratingPanel.tsx
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Circle, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useVideoStore } from "../../store/useVideoStore";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED } from "../../api/types";

export function GeneratingPanel() {
  const { t } = useTranslation();
  const { taskStatus, error, setPanel } = useProjectWorkspaceStore();
  const [logsOpen, setLogsOpen] = useState(false);
  const logsRef = useRef<HTMLDivElement | null>(null);
  const progress = taskStatus?.progress ?? 0;
  const logs = taskStatus?.logs ?? [];

  const STEPS = [
    { label: t("panels.generating.steps.scriptReady"), threshold: 5 },
    { label: t("panels.generating.steps.audioSynthesized"), threshold: 20 },
    { label: t("panels.generating.steps.timestampsExtracted"), threshold: 30 },
    { label: t("panels.generating.steps.downloadingClips"), threshold: 70 },
    { label: t("panels.generating.steps.assemblingVideo"), threshold: 90 },
    { label: t("panels.generating.steps.burningSubtitles"), threshold: 99 },
  ];

  const projectStore = useProjectStore();
  const isProjectMode = projectStore.orchestrationStep !== null;

  const PROJECT_STEPS: { key: "plan" | "media" | "narration" | "timeline"; label: string }[] = [
    { key: "plan", label: t("panels.generating.projectSteps.plan") },
    { key: "media", label: t("panels.generating.projectSteps.media") },
    { key: "narration", label: t("panels.generating.projectSteps.narration") },
    { key: "timeline", label: t("panels.generating.projectSteps.timeline") },
  ];
  const currentStepIndex = PROJECT_STEPS.findIndex((s) => s.key === projectStore.orchestrationStep);
  const hasFailed = projectStore.mode === "error" || projectStore.mode === "disabled";
  const handleRetry = () => {
    void projectStore.generateViaProjectMode(useVideoStore.getState().toParams());
  };

  // Auto-transition on completion
  useEffect(() => {
    if (taskStatus?.state === TASK_STATE_COMPLETE) {
      setPanel("review");
    }
  }, [taskStatus?.state, setPanel]);

  useEffect(() => {
    if (logsOpen && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logsOpen, logs]);

  if (isProjectMode) {
    return (
      <div className="flex h-full w-full max-w-5xl mx-auto flex-col justify-start px-6 py-5">
        <div className="w-full max-w-md space-y-6">
          <h2 className="text-sm font-semibold text-foreground">{t("panels.generating.title")}</h2>

          {hasFailed && (
            <div className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 space-y-2">
              <p className="text-xs text-red-400">{projectStore.error}</p>
              <button
                onClick={handleRetry}
                className="text-xs text-red-300 underline hover:text-red-100"
              >
                {t("panels.generating.tryAgain")}
              </button>
            </div>
          )}

          <ul className="space-y-2">
            {PROJECT_STEPS.map((step, idx) => {
              const done = idx < currentStepIndex;
              const failed = idx === currentStepIndex && hasFailed;
              const active = idx === currentStepIndex && !hasFailed;
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <Check className="h-4 w-4 shrink-0 text-green-400" />
                  ) : failed ? (
                    <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-border" />
                  )}
                  <span className={done ? "text-muted line-through" : failed ? "text-red-400" : active ? "text-foreground" : "text-muted"}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full max-w-5xl mx-auto flex-col justify-start px-6 py-5">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-sm font-semibold text-foreground">{t("panels.generating.title")}</h2>

        {error && (
          <div className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 space-y-2">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={() => setPanel("config")}
              className="text-xs text-red-300 underline hover:text-red-100"
            >
              {t("panels.generating.tryAgain")}
            </button>
          </div>
        )}

        {taskStatus?.state === TASK_STATE_FAILED && !error && (
          <div className="rounded-md border border-red-800 bg-red-900/20 px-3 py-2 space-y-2">
            <p className="text-xs text-red-400">{t("panels.generating.failed")}</p>
            <button
              onClick={() => setPanel("config")}
              className="text-xs text-red-300 underline hover:text-red-100"
            >
              {t("panels.generating.tryAgain")}
            </button>
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{t("panels.generating.progress")}</span>
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
          {logsOpen ? t("panels.generating.hideLogs") : t("panels.generating.showLogs")}
        </button>
        {logsOpen && (
          <div
            ref={logsRef}
            className="rounded-md border border-border bg-base p-3 font-mono text-xs text-muted h-36 overflow-y-auto"
          >
            {logs.length > 0 ? (
              logs.map((line, index) => (
                <p key={`${index}-${line}`} className="whitespace-pre-wrap leading-relaxed">
                  {line}
                </p>
              ))
            ) : (
              <p>{t("panels.generating.waitingLogs", { progress })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
