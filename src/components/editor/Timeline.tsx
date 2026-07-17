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
import { Film, Music, Captions, ZoomIn, ZoomOut } from "lucide-react";
import { TimelineVideoCard } from "./TimelineVideoCard";
import { moveCommandsForOrder, findItemAtTime } from "../../lib/timelineCommands";
import { formatTime } from "../../lib/time";
import type { EditCommand, TimelineItem, TimelineTrack } from "../../api/types";

interface TimelineProps {
  videoTrack: TimelineTrack | undefined;
  audioTrack: TimelineTrack | undefined;
  subtitleTrack: TimelineTrack | undefined;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (commands: EditCommand[]) => void;
  currentTime?: number;
}

const ZOOM_STEPS = [8, 12, 16, 24, 32, 48, 64, 96];
const DEFAULT_ZOOM_INDEX = 3; // 24px/sec
const TICK_INTERVALS = [1, 2, 5, 10, 15, 30, 60, 120, 300];
const MIN_TICK_SPACING_PX = 50;

function trackEnd(track: TimelineTrack | undefined): number {
  const items = track?.items ?? [];
  if (items.length === 0) return 0;
  const last = items[items.length - 1];
  return last.start_sec + last.duration_sec;
}

export function Timeline({
  videoTrack,
  audioTrack,
  subtitleTrack,
  selectedId,
  onSelect,
  onReorder,
  currentTime = 0,
}: TimelineProps) {
  const videoItems = videoTrack?.items ?? [];
  const [orderedItems, setOrderedItems] = useState<TimelineItem[]>(videoItems);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const pxPerSecond = ZOOM_STEPS[zoomIndex];

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

  const LEFT_OFFSET_PX = 72; // Padding (12px) + Label (56px) + Gap (4px)

  const totalDuration = Math.max(
    trackEnd(videoTrack),
    trackEnd(audioTrack),
    trackEnd(subtitleTrack),
    1
  );
  const tickInterval =
    TICK_INTERVALS.find((i) => i * pxPerSecond >= MIN_TICK_SPACING_PX) ??
    TICK_INTERVALS[TICK_INTERVALS.length - 1];
  const tickCount = Math.ceil(totalDuration / tickInterval) + 1;
  const contentWidthPx = LEFT_OFFSET_PX + totalDuration * pxPerSecond + 48;
  const playheadLeftPx = Math.min(currentTime, totalDuration) * pxPerSecond;

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const time = (clickX - LEFT_OFFSET_PX) / pxPerSecond;
    if (time >= 0) {
      const item = findItemAtTime(orderedItems, time);
      if (item) onSelect(item.id);
    }
  };

  return (
    <div className="border-t border-border bg-base">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60">
        <span className="text-[10px] uppercase tracking-widest text-muted">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Zoom out"
            data-testid="timeline-zoom-out"
            disabled={zoomIndex === 0}
            onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            className="rounded p-1 text-muted hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Zoom in"
            data-testid="timeline-zoom-in"
            disabled={zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            className="rounded p-1 text-muted hover:text-foreground hover:bg-surface disabled:opacity-30 disabled:pointer-events-none"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="relative" style={{ width: `${contentWidthPx}px` }}>
          {/* Playhead spans the full track stack */}
          <div
            data-testid="timeline-playhead"
            className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500"
            style={{ left: `${LEFT_OFFSET_PX + playheadLeftPx}px` }}
          >
            <div className="absolute -top-1 -left-[3px] h-1.5 w-1.5 rotate-45 bg-red-500" />
          </div>

          {/* Ruler */}
          <div
            data-testid="timeline-ruler"
            onClick={handleRulerClick}
            className="relative h-5 cursor-pointer border-b border-border/60 bg-base"
          >
            {/* Sticky spacer block on the left to cover scrolling ticks */}
            <div className="sticky left-0 top-0 bottom-0 z-30 w-[72px] bg-base border-r border-transparent" />

            {Array.from({ length: tickCount }, (_, i) => i * tickInterval).map((t) => (
              <div
                key={t}
                className="absolute top-0 bottom-0 flex items-end"
                style={{ left: `${LEFT_OFFSET_PX + t * pxPerSecond}px` }}
              >
                <span className="h-2 w-px bg-border" />
                <span className="pl-1 pb-0.5 text-[9px] text-muted tabular-nums">
                  {formatTime(t)}
                </span>
              </div>
            ))}
          </div>

          {/* Video track */}
          <div className="flex items-center gap-0 px-3 py-2 border-b border-border/40">
            <span className="sticky left-0 z-30 flex w-14 shrink-0 items-center gap-1 bg-base text-[10px] uppercase tracking-wide text-muted mr-1">
              <Film className="h-3 w-3" /> Video
            </span>
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
                      widthPx={item.duration_sec * pxPerSecond}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>

          {/* Audio track */}
          <div className="relative h-12 px-3 border-b border-border/40 flex items-center">
            <span className="sticky left-0 z-30 flex w-14 shrink-0 items-center gap-1 bg-base text-[10px] uppercase tracking-wide text-muted mr-1">
              <Music className="h-3 w-3" /> Audio
            </span>
            <div className="absolute inset-y-0 left-0 right-0 pointer-events-none">
              <div className="relative w-full h-full" style={{ marginLeft: `${LEFT_OFFSET_PX}px` }}>
                {(audioTrack?.items ?? []).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    data-testid={`audio-${item.id}`}
                    className={`absolute top-2 h-8 rounded border px-2 flex items-center text-[10px] transition-all truncate select-none pointer-events-auto ${
                      selectedId === item.id
                        ? "border-accent bg-accent/20 ring-1 ring-accent text-foreground font-medium"
                        : "border-border bg-surface hover:border-accent/50 text-muted-foreground hover:bg-surface/80"
                    }`}
                    style={{
                      left: `${item.start_sec * pxPerSecond}px`,
                      width: `${Math.max(item.duration_sec * pxPerSecond, 40)}px`,
                    }}
                  >
                    <span className="truncate w-full text-left font-mono">{item.text || `${item.duration_sec.toFixed(1)}s`}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subtitle track */}
          <div className="relative h-10 px-3 border-b border-border/40 flex items-center">
            <span className="sticky left-0 z-30 flex w-14 shrink-0 items-center gap-1 bg-base text-[10px] uppercase tracking-wide text-muted mr-1">
              <Captions className="h-3 w-3" /> Subs
            </span>
            <div className="absolute inset-y-0 left-0 right-0 pointer-events-none">
              <div className="relative w-full h-full" style={{ marginLeft: `${LEFT_OFFSET_PX}px` }}>
                {(subtitleTrack?.items ?? []).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => onSelect(item.id)}
                    data-testid={`subtitle-${item.id}`}
                    className={`absolute top-2 h-6 rounded border px-2 flex items-center text-[10px] transition-all truncate select-none pointer-events-auto ${
                      selectedId === item.id
                        ? "border-accent bg-accent/20 ring-1 ring-accent text-foreground font-medium"
                        : "border-border/60 bg-surface/60 hover:border-accent/40 text-muted-foreground hover:bg-surface/80"
                    }`}
                    style={{
                      left: `${item.start_sec * pxPerSecond}px`,
                      width: `${Math.max(item.duration_sec * pxPerSecond, 40)}px`,
                    }}
                  >
                    <span className="truncate w-full text-left font-mono">{item.text || `${item.duration_sec.toFixed(1)}s`}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
