import { useTranslation } from "react-i18next";
import type { WorkspacePanel } from "../../types/workspace";

const BADGE: Record<WorkspacePanel, { key: string; cls: string }> = {
  script:     { key: "state.draft",      cls: "bg-muted/20 text-muted" },
  config:     { key: "state.ready",      cls: "bg-violet-500/20 text-violet-400" },
  generating: { key: "state.generating", cls: "bg-amber-500/20 text-amber-400" },
  review:     { key: "state.review",     cls: "bg-blue-500/20 text-blue-400" },
  editor:     { key: "state.editing",    cls: "bg-accent/20 text-accent" },
  rendering:  { key: "state.rendering",  cls: "bg-amber-500/20 text-amber-400" },
  done:       { key: "state.done",       cls: "bg-green-500/20 text-green-400" },
  publication: { key: "state.publication", cls: "bg-accent/20 text-accent" },
};

interface StateBadgeProps {
  panel: WorkspacePanel;
}

export function StateBadge({ panel }: StateBadgeProps) {
  const { t } = useTranslation();
  const { key, cls } = BADGE[panel];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {t(key)}
    </span>
  );
}
