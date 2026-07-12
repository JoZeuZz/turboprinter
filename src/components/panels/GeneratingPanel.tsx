// webui-react/src/components/panels/GeneratingPanel.tsx
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Circle, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import { useVideoStore } from "../../store/useVideoStore";
import { TASK_STATE_FAILED } from "../../api/types";

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

  // The transition to the review page is now driven directly by the async generateVideo lifecycle in the workspace store
  // once the final successful task status and video URLs are securely retrieved.

  useEffect(() => {
    if (logsOpen && logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logsOpen, logs]);

  if (isProjectMode) {
    return (
      <div className="flex h-full min-h-[80vh] w-full max-w-5xl mx-auto flex-col justify-center items-center px-6 py-12">
        <div className="w-full max-w-md space-y-6 bg-neutral-900/60 p-8 rounded-2xl border border-border/80 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2.5 justify-center pb-3 border-b border-border/40">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            <h2 className="text-sm font-semibold text-foreground">{t("panels.generating.title")}</h2>
          </div>

          {hasFailed && (
            <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3.5 space-y-3">
              <div className="max-h-60 overflow-y-auto pr-1">
                <p className="text-xs text-red-400 whitespace-pre-wrap leading-relaxed font-mono select-text text-left">
                  {projectStore.error}
                </p>
              </div>
              <div className="pt-1 border-t border-red-900/30 flex justify-end">
                <button
                  onClick={handleRetry}
                  className="text-xs text-red-300 font-medium hover:text-red-100 transition-colors bg-red-900/40 px-2.5 py-1 rounded border border-red-800/50 hover:bg-red-900/60"
                >
                  {t("panels.generating.tryAgain")}
                </button>
              </div>
            </div>
          )}

          <ul className="space-y-3.5">
            {PROJECT_STEPS.map((step, idx) => {
              const done = idx < currentStepIndex;
              const failed = idx === currentStepIndex && hasFailed;
              const active = idx === currentStepIndex && !hasFailed;
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  {done ? (
                    <Check className="h-4.5 w-4.5 shrink-0 text-green-400" />
                  ) : failed ? (
                    <XCircle className="h-4.5 w-4.5 shrink-0 text-red-400" />
                  ) : active ? (
                    <Loader2 className="h-4.5 w-4.5 shrink-0 animate-spin text-accent" />
                  ) : (
                    <Circle className="h-4.5 w-4.5 shrink-0 text-border" />
                  )}
                  <span className={done ? "text-muted line-through" : failed ? "text-red-400 font-medium" : active ? "text-foreground font-medium" : "text-muted"}>
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
    <div className="flex h-full min-h-[80vh] w-full max-w-5xl mx-auto flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 bg-neutral-900/60 p-8 rounded-2xl border border-border/80 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-2.5 justify-center pb-3 border-b border-border/40">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
          <h2 className="text-sm font-semibold text-foreground">{t("panels.generating.title")}</h2>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3.5 space-y-3">
            <div className="max-h-60 overflow-y-auto pr-1">
              <p className="text-xs text-red-400 whitespace-pre-wrap leading-relaxed font-mono select-text text-left">
                {error}
              </p>
            </div>
            <div className="pt-1 border-t border-red-900/30 flex justify-end">
              <button
                onClick={() => setPanel("config")}
                className="text-xs text-red-300 font-medium hover:text-red-100 transition-colors bg-red-900/40 px-2.5 py-1 rounded border border-red-800/50 hover:bg-red-900/60"
              >
                {t("panels.generating.tryAgain")}
              </button>
            </div>
          </div>
        )}

        {taskStatus?.state === TASK_STATE_FAILED && !error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3.5 space-y-3 text-center">
            <p className="text-xs text-red-400 font-medium">{t("panels.generating.failed")}</p>
            <button
              onClick={() => setPanel("config")}
              className="text-xs text-red-300 underline hover:text-red-100 font-medium"
            >
              {t("panels.generating.tryAgain")}
            </button>
          </div>
        )}

        <div className="space-y-1.5">
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

        <ul className="space-y-3.5">
          {STEPS.map(({ label, threshold }) => {
            const done = progress >= threshold;
            const active = !done && progress >= threshold - 30 && progress < threshold;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                {done ? (
                  <Check className="h-4.5 w-4.5 shrink-0 text-green-400" />
                ) : active ? (
                  <Loader2 className="h-4.5 w-4.5 shrink-0 animate-spin text-accent" />
                ) : (
                  <Circle className="h-4.5 w-4.5 shrink-0 text-border" />
                )}
                <span
                  className={
                    done
                      ? "text-muted line-through"
                      : active
                      ? "text-foreground font-medium"
                      : "text-muted"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            onClick={() => setLogsOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors py-1 px-2 rounded hover:bg-neutral-800/30"
          >
            {logsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {logsOpen ? t("panels.generating.hideLogs") : t("panels.generating.showLogs")}
          </button>
        </div>
        {logsOpen && (
          <div
            ref={logsRef}
            className="rounded-md border border-border bg-base p-3 font-mono text-xs text-muted h-36 overflow-y-auto shadow-inner"
          >
            {logs.length > 0 ? (
              logs.map((line, index) => (
                <p key={`${index}-${line}`} className="whitespace-pre-wrap leading-relaxed select-text text-left">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-center py-4">{t("panels.generating.waitingLogs", { progress })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
