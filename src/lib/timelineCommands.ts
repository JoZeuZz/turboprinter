import type { EditCommand, TimelineItem } from "../api/types";

export function findItemAtTime(
  items: TimelineItem[],
  time: number
): TimelineItem | null {
  if (items.length === 0) return null;
  for (const item of items) {
    if (time < item.start_sec + item.duration_sec) return item;
  }
  return items[items.length - 1];
}

export function moveCommandsForOrder(
  trackId: string,
  items: TimelineItem[]
): EditCommand[] {
  let accStart = 0;
  return items.map((item) => {
    const command: EditCommand = {
      type: "move",
      track_id: trackId,
      item_id: item.id,
      new_start_sec: accStart,
    };
    accStart += item.duration_sec;
    return command;
  });
}
