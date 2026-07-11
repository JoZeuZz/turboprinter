// webui-react/src/components/panels/EditorPanel.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { VideoPreview } from "../editor/VideoPreview";
import { ClipInspector } from "../editor/ClipInspector";
import { Timeline } from "../editor/Timeline";
import { Button } from "../ui";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import type { EditCommand, TimelineItem } from "../../api/types";

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function EditorPanel() {
  const { t } = useTranslation();
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const audioTrack = projectStore.project?.tracks.find((t) => t.type === "audio");
  const subtitleTrack = projectStore.project?.tracks.find((t) => t.type === "subtitle");
  const items: TimelineItem[] = videoTrack?.items ?? [];

  const selectedClip = items.find((c) => c.id === selectedId) ?? null;

  const handleTrimChange = (id: string, start: number, end: number | null) => {
    void projectStore.applyTimelineCommands({
      commands: [
        {
          type: "trim",
          track_id: videoTrack?.id ?? "",
          item_id: id,
          trim_start_sec: start,
          trim_end_sec: end,
        },
      ],
    });
  };

  const handleRemove = (id: string) => {
    void projectStore.applyTimelineCommands({
      commands: [
        {
          type: "move",
          track_id: videoTrack?.id ?? "",
          item_id: id,
          new_start_sec: -1,
        },
      ],
    });
    if (selectedId === id) setSelectedId(null);
  };

  const handleReorder = (commands: EditCommand[]) => {
    void projectStore.applyTimelineCommands({ commands });
  };

  const handleRender = () => {
    void projectStore.render();
    setPanel("rendering");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        handleRemove(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, videoTrack?.id]);

  if (projectStore.mode === "disabled") {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm p-8 text-center">
        {t("editor.notAvailable")}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top: preview + inspector */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[3] p-4">
          <VideoPreview items={items} selectedId={selectedId} onTimeUpdate={setCurrentTime} />
        </div>
        <div className="flex-[2] border-l border-border overflow-y-auto">
          <ClipInspector
            clip={selectedClip}
            onTrimChange={handleTrimChange}
            onRemove={handleRemove}
          />
        </div>
      </div>

      {/* Bottom: timeline */}
      <Timeline
        videoTrack={videoTrack}
        audioTrack={audioTrack}
        subtitleTrack={subtitleTrack}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onReorder={handleReorder}
        currentTime={currentTime}
      />

      {/* Footer actions */}
      <div className="flex items-center justify-between border-t border-border px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => setPanel("review")}>
          {t("editor.backToReview")}
        </Button>
        <Button size="sm" onClick={handleRender}>
          {t("editor.render")}
        </Button>
      </div>
    </div>
  );
}
