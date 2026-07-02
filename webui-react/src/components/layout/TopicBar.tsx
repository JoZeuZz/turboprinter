import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { StateBadge } from "../ui/StateBadge";
import { OriginBadge } from "./OriginBadge";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import { deriveVideoOrigin } from "../../lib/videoOrigin";

const MODE_BADGE: Record<string, { label: string; className: string }> = {
  idle: { label: "idle", className: "text-muted" },
  loading: { label: "loading…", className: "text-yellow-400 animate-pulse" },
  ready: { label: "ready", className: "text-green-400" },
  disabled: { label: "offline", className: "text-muted" },
  error: { label: "error", className: "text-red-400" },
};

export function TopicBar() {
  const { t } = useTranslation();
  const { topic, setTopic, panel, taskId, taskStatus, videoUrls } = useProjectWorkspaceStore();
  const { id: routeId } = useParams();
  const origin = deriveVideoOrigin({
    routeId,
    taskId,
    taskState: taskStatus?.state,
    panel,
    videoUrls,
  });
  const { mode } = useProjectStore();
  const updateCurrentDraft = useProjectHistoryStore((s) => s.updateCurrentDraft);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const nextTopic = draft.trim() || topic;
    setTopic(nextTopic);
    updateCurrentDraft(nextTopic);
    setEditing(false);
  };

  const badge = MODE_BADGE[mode] ?? MODE_BADGE.idle;

  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-surface px-4 gap-3">
      <OriginBadge origin={origin} />
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(topic);
              setEditing(false);
            }
          }}
          className="flex-1 bg-transparent text-sm text-foreground outline-none"
          placeholder={t("topbar.untitledProject")}
        />
      ) : (
        <button
          onClick={() => {
            setDraft(topic);
            setEditing(true);
          }}
          className="flex-1 text-left text-sm text-foreground hover:text-accent truncate"
        >
          {topic || <span className="text-muted">{t("topbar.untitledProject")}</span>}
        </button>
      )}

      <span className={`text-[10px] font-medium shrink-0 ${badge.className}`}>
        {badge.label}
      </span>

      <StateBadge panel={panel} />
    </div>
  );
}
