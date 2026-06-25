// webui-react/src/components/panels/ReviewPanel.tsx
import { useState, useEffect } from "react";
import { ArrowLeft, Clapperboard } from "lucide-react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Button } from "../ui";
import { ClipPreviewModal } from "../ui/ClipPreviewModal";
import { SortableClipCard } from "./SortableClipCard";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import type { TimelineItem, EditCommand } from "../../api/types";

export function ReviewPanel() {
  const projectStore = useProjectStore();
  const { setPanel } = useProjectWorkspaceStore();

  const videoTrack = projectStore.project?.tracks.find((t) => t.type === "video");
  const sourceClips = videoTrack?.items ?? [];

  const [orderedClips, setOrderedClips] = useState<TimelineItem[]>(sourceClips);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [previewClip, setPreviewClip] = useState<TimelineItem | null>(null);

  // Sync orderedClips when project loads
  useEffect(() => {
    setOrderedClips(sourceClips);
  }, [sourceClips.length]);

  if (projectStore.mode === "disabled") {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-8 text-center">
        <p className="text-sm text-muted">Review not available — rendering directly</p>
        <p className="text-xs text-muted mt-1">
          Enable project mode on the server to use clip review.
        </p>
        <Button className="mt-4" onClick={() => setPanel("done")}>
          Continue to Done
        </Button>
      </div>
    );
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setOrderedClips((clips) => {
        const oldIndex = clips.findIndex((c) => c.id === active.id);
        const newIndex = clips.findIndex((c) => c.id === over.id);
        return arrayMove(clips, oldIndex, newIndex);
      });
    }
  };

  const handleExclude = (clipId: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(clipId)) next.delete(clipId);
      else next.add(clipId);
      return next;
    });
  };

  const totalDuration = orderedClips
    .filter((c) => !excluded.has(c.id))
    .reduce((sum, c) => sum + c.duration_sec, 0);

  const handleRender = async () => {
    const trackId = videoTrack?.id ?? "";
    let accStart = 0;
    const commands: EditCommand[] = [];

    for (const clip of orderedClips) {
      if (excluded.has(clip.id)) {
        commands.push({
          type: "set_timing",
          track_id: trackId,
          item_id: clip.id,
          duration_sec: 0,
        });
      } else {
        commands.push({
          type: "move",
          track_id: trackId,
          item_id: clip.id,
          new_start_sec: accStart,
        });
        accStart += clip.duration_sec;
      }
    }

    if (commands.length > 0) {
      await projectStore.applyTimelineCommands({ commands });
    }
    await projectStore.render();
    setPanel("rendering");
  };

  return (
    <div className="flex flex-col min-h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Review clips</h2>
          <p className="text-xs text-muted mt-0.5">
            {orderedClips.length} clips · ~{totalDuration.toFixed(0)}s total
            {excluded.size > 0 && ` · ${excluded.size} excluded`}
          </p>
        </div>
      </div>

      {orderedClips.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted">No clips found. Build a timeline first.</p>
        </div>
      ) : (
        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={orderedClips.map((c) => c.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {orderedClips.map((clip) => (
                <SortableClipCard
                  key={clip.id}
                  clip={clip}
                  excluded={excluded.has(clip.id)}
                  onExclude={handleExclude}
                  onPreview={setPreviewClip}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button variant="ghost" onClick={() => setPanel("script")}>
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          ← Back to Script
        </Button>
        <Button onClick={handleRender} className="flex-1">
          <Clapperboard className="mr-1.5 h-3.5 w-3.5" />
          Render Video →
        </Button>
      </div>

      <ClipPreviewModal
        clip={previewClip}
        onClose={() => setPreviewClip(null)}
      />
    </div>
  );
}
