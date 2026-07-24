// webui-react/src/components/panels/GeneratingPanel.tsx
import { Check, Loader2, Circle, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../store/useProjectStore";
import { useVideoStore } from "../../store/useVideoStore";

export function GeneratingPanel() {
  const { t } = useTranslation();
  const projectStore = useProjectStore();

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
            const done = currentStepIndex >= 0 && idx < currentStepIndex;
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
