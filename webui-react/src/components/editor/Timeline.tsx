// webui-react/src/components/editor/Timeline.tsx
import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { TimelineVideoCard } from "./TimelineVideoCard";
import { moveCommandsForOrder } from "../../lib/timelineCommands";
import type { EditCommand, TimelineItem, TimelineTrack } from "../../api/types";

interface TimelineProps {
  videoTrack: TimelineTrack | undefined;
  audioTrack: TimelineTrack | undefined;
  subtitleTrack: TimelineTrack | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (commands: EditCommand[]) => void;
}

export function Timeline({
  videoTrack,
  audioTrack,
  subtitleTrack,
  selectedId,
  onSelect,
  onReorder,
}: TimelineProps) {
  const videoItems = videoTrack?.items ?? [];
  const [orderedItems, setOrderedItems] = useState<TimelineItem[]>(videoItems);
  // A click and a drag both start with the same pointerdown on this card (it's the
  // whole-card drag handle, see TimelineVideoCard). Without a movement threshold,
  // dnd-kit's PointerSensor treats every press as the start of a drag and swallows
  // the subsequent native click, so TimelineVideoCard's onClick never fires. Requiring
  // 8px of movement before a drag activates lets a plain click (zero movement) through.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  useEffect(() => {
    setOrderedItems(videoTrack?.items ?? []);
  }, [videoTrack?.items.length, videoTrack?.id]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !videoTrack) return;

    const oldIndex = orderedItems.findIndex((c) => c.id === active.id);
    const newIndex = orderedItems.findIndex((c) => c.id === over.id);
    const reordered = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(reordered);
    onReorder(moveCommandsForOrder(videoTrack.id, reordered));
  };

  return (
    <div className="border-t border-border bg-base divide-y divide-border">
      <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto">
        {orderedItems.length > 0 && (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={orderedItems.map((c) => c.id)}
              strategy={horizontalListSortingStrategy}
            >
              {orderedItems.map((item) => (
                <TimelineVideoCard
                  key={item.id}
                  item={item}
                  isSelected={item.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-muted">Audio</span>
        {(audioTrack?.items ?? []).map((item) => (
          <div
            key={item.id}
            data-testid={`audio-${item.id}`}
            className="h-8 shrink-0 rounded border border-border bg-surface px-2 flex items-center text-[10px] text-muted"
            style={{ minWidth: "60px" }}
          >
            {item.duration_sec.toFixed(1)}s
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 overflow-x-auto">
        <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-muted">Subs</span>
        {(subtitleTrack?.items ?? []).map((item) => (
          <div
            key={item.id}
            data-testid={`subtitle-${item.id}`}
            className="h-6 shrink-0 rounded border border-border/60 bg-surface/60 px-2 flex items-center text-[10px] text-muted"
            style={{ minWidth: "60px" }}
          >
            {item.duration_sec.toFixed(1)}s
          </div>
        ))}
      </div>
    </div>
  );
}
