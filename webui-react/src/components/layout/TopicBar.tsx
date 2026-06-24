import { useState, useRef, useEffect } from "react";
import { StateBadge } from "../ui/StateBadge";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

export function TopicBar() {
  const { topic, setTopic, panel } = useProjectWorkspaceStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(topic);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setTopic(draft.trim() || topic);
    setEditing(false);
  };

  return (
    <div className="flex h-10 items-center justify-between border-b border-border bg-surface px-4">
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
          placeholder="Untitled project"
        />
      ) : (
        <button
          onClick={() => {
            setDraft(topic);
            setEditing(true);
          }}
          className="flex-1 text-left text-sm text-foreground hover:text-accent truncate"
        >
          {topic || <span className="text-muted">Untitled project</span>}
        </button>
      )}
      <StateBadge panel={panel} />
    </div>
  );
}
