import type { WorkspacePanel } from "../../types/workspace";

const BADGE: Record<WorkspacePanel, { label: string; cls: string }> = {
  script:     { label: "Draft",        cls: "bg-muted/20 text-muted" },
  config:     { label: "Ready",        cls: "bg-violet-500/20 text-violet-400" },
  generating: { label: "Generating…",  cls: "bg-amber-500/20 text-amber-400" },
  review:     { label: "Review",       cls: "bg-blue-500/20 text-blue-400" },
  editor:     { label: "Editing",      cls: "bg-accent/20 text-accent" },
  rendering:  { label: "Rendering…",   cls: "bg-amber-500/20 text-amber-400" },
  done:       { label: "Done",         cls: "bg-green-500/20 text-green-400" },
};

interface StateBadgeProps {
  panel: WorkspacePanel;
}

export function StateBadge({ panel }: StateBadgeProps) {
  const { label, cls } = BADGE[panel];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
