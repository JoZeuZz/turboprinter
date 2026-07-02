import { useTranslation } from "react-i18next";
import { CheckCircle2, FilePenLine, History, Loader2 } from "lucide-react";
import type { VideoOrigin } from "../../lib/videoOrigin";

const CONFIG: Record<
  VideoOrigin,
  { key: string; className: string; Icon: typeof History; spin?: boolean }
> = {
  draft:      { key: "origin.draft",      className: "text-muted",        Icon: FilePenLine },
  history:    { key: "origin.history",    className: "text-blue-400",     Icon: History },
  generating: { key: "origin.generating", className: "text-yellow-400",   Icon: Loader2, spin: true },
  finished:   { key: "origin.finished",   className: "text-green-400",    Icon: CheckCircle2 },
};

export function OriginBadge({ origin }: { origin: VideoOrigin }) {
  const { t } = useTranslation();
  const { key, className, Icon, spin } = CONFIG[origin];
  return (
    <span
      data-testid="origin-badge"
      data-origin={origin}
      className={`inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium shrink-0 ${className}`}
    >
      <Icon className={`h-3 w-3 ${spin ? "animate-spin" : ""}`} />
      {t(key)}
    </span>
  );
}
