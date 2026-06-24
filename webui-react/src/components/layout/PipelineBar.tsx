import { Check } from "lucide-react";
import { PANEL_ORDER, PANEL_LABEL } from "../../types/workspace";
import type { WorkspacePanel } from "../../types/workspace";

interface PipelineBarProps {
  currentPanel: WorkspacePanel;
  completedPanels: WorkspacePanel[];
}

export function PipelineBar({ currentPanel, completedPanels }: PipelineBarProps) {
  return (
    <div className="flex items-center justify-center gap-0 border-t border-border bg-surface px-4 py-2">
      {PANEL_ORDER.map((panel, idx) => {
        const isDone = completedPanels.includes(panel);
        const isActive =
          panel === currentPanel ||
          (currentPanel === "editor" && panel === "review") ||
          (currentPanel === "rendering" && panel === "done");
        const isFuture = !isDone && !isActive;

        return (
          <div key={panel} className="flex items-center">
            {idx > 0 && (
              <div className={`h-px w-8 ${isDone ? "bg-accent" : "bg-border"}`} />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  isDone
                    ? "bg-accent text-white"
                    : isActive
                    ? "border-2 border-accent bg-transparent text-accent"
                    : "border border-border bg-transparent text-muted"
                }`}
              >
                {isDone ? (
                  <Check className="h-3 w-3" data-testid={`step-done-${panel}`} />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium tracking-wide ${
                  isActive ? "text-foreground" : isFuture ? "text-muted" : "text-accent"
                }`}
              >
                {PANEL_LABEL[panel]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
