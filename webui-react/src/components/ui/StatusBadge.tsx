import { useTranslation } from "react-i18next";
import type { WorkspacePanel } from "../../types/workspace";
import { resolveStatus } from "../../lib/statusBadge";
import { StateBadge } from "./StateBadge";

const CONNECTIVITY = {
  loading: { key: "status.loading", cls: "text-yellow-400 animate-pulse" },
  offline: { key: "status.offline", cls: "text-muted" },
  error:   { key: "status.error",   cls: "text-red-400" },
} as const;

export function StatusBadge({ mode, panel }: { mode: string; panel: WorkspacePanel }) {
  const { t } = useTranslation();
  const status = resolveStatus(mode, panel);
  if (status.kind === "phase") {
    return <StateBadge panel={status.panel} />;
  }
  const cfg = CONNECTIVITY[status.kind];
  return (
    <span className={`text-[10px] font-medium shrink-0 ${cfg.cls}`}>{t(cfg.key)}</span>
  );
}
