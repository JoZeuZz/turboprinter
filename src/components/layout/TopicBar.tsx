import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { StatusBadge } from "../ui/StatusBadge";
import { OriginBadge } from "./OriginBadge";
import { useProjectHistoryStore } from "../../store/useProjectHistoryStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useProjectStore } from "../../store/useProjectStore";
import { deriveVideoOrigin } from "../../lib/videoOrigin";

export function TopicBar() {
  const { t } = useTranslation();
  const { topic, setTopic, panel, videoUrls } = useProjectWorkspaceStore();
  const { id: routeId } = useParams();
  const origin = deriveVideoOrigin({
    routeId,
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

      <StatusBadge mode={mode} panel={panel} />
    </div>
  );
}
