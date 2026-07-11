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
    <div className="flex h-full w-full max-w-5xl mx-auto flex-col justify-start px-6 py-5">
      <div className="w-full max-w-md space-y-6">
        <h2 className="text-sm font-semibold text-foreground">{t("panels.rendering.title")}</h2>

        {!isFailed && (
          <div className="space-y-1">
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
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{t("panels.rendering.assembling")}</span>
          </div>
        )}

        {isDone && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            <span>{t("panels.rendering.complete")}</span>
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2 text-sm text-red-400">
            <XCircle className="h-4 w-4" />
            <span>{status?.error ?? t("panels.rendering.failed")}</span>
          </div>
        )}

        {(isDone || isFailed) && (
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
          >
            {isDone ? t("panels.rendering.viewResult") : t("panels.rendering.backToEditor")}
          </Button>
        )}
      </div>
    </div>
  );
}
