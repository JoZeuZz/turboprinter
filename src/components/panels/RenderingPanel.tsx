// webui-react/src/components/panels/RenderingPanel.tsx
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED } from "../../api/types";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "../ui";

export function RenderingPanel() {
  const { t } = useTranslation();
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();

  useEffect(() => {
    if (projectStore.projectId && projectStore.mode !== "loading") {
      void projectStore.render();
    }
  }, []);

  const status = projectStore.renderStatus;
  const progress = status?.progress ?? 0;
  const isDone = status?.state === TASK_STATE_COMPLETE;
  const isFailed = status?.state === TASK_STATE_FAILED;

  return (
    <div className="flex h-full min-h-[80vh] w-full max-w-5xl mx-auto flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-md space-y-6 bg-neutral-900/60 p-8 rounded-2xl border border-border/80 shadow-2xl backdrop-blur-md">
        <h2 className="text-sm font-semibold text-foreground text-center pb-3 border-b border-border/40">{t("panels.rendering.title")}</h2>

        {!isFailed && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{t("panels.rendering.progress")}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {!isDone && !isFailed && (
          <div className="flex items-center gap-2.5 text-sm text-muted justify-center py-2">
            <Loader2 className="h-4.5 w-4.5 animate-spin text-accent" />
            <span>{t("panels.rendering.assembling")}</span>
          </div>
        )}

        {isDone && (
          <div className="flex items-center gap-2.5 text-sm text-green-400 justify-center py-2">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">{t("panels.rendering.complete")}</span>
          </div>
        )}

        {isFailed && (
          <div className="flex flex-col items-center gap-2 text-sm text-red-400 justify-center py-2 bg-red-950/20 border border-red-900/60 rounded-lg p-4">
            <XCircle className="h-6 w-6 shrink-0" />
            <div className="max-h-48 overflow-y-auto w-full text-center">
              <p className="text-xs whitespace-pre-wrap font-mono select-text">{status?.error ?? t("panels.rendering.failed")}</p>
            </div>
          </div>
        )}

        {(isDone || isFailed) && (
          <div className="flex justify-center pt-2">
            <Button
              onClick={() => {
                if (isDone && status?.output_path) {
                  useProjectWorkspaceStore.setState({
                    videoUrls: [status.output_path],
                  });
                }
                setPanel(isDone ? "done" : "editor");
              }}
              size="sm"
              className="w-full sm:w-auto"
            >
              {isDone ? t("panels.rendering.viewResult") : t("panels.rendering.backToEditor")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
