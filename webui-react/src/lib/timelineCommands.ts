import type { EditCommand, TimelineItem } from "../api/types";

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
