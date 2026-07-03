// webui-react/src/components/panels/EditorPanel.tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { VideoPreview } from "../editor/VideoPreview";
import { ClipInspector } from "../editor/ClipInspector";
import { Timeline } from "../editor/Timeline";
import { Button } from "../ui";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import type { EditCommand, TimelineItem } from "../../api/types";

export function EditorPanel() {
  const { t } = useTranslation();
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Project mode disabled fallback
  if (projectStore.mode === "disabled") {
    return (
      <div className="flex items-center justify-center h-full text-muted text-sm p-8 text-center">
        {t("editor.notAvailable")}
      </div>
    );
  }

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

  return (
    <div className="flex flex-col h-full">
      {/* Top: preview + inspector */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-[3] p-4">
          <VideoPreview src={selectedClip?.local_path ?? undefined} />
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
