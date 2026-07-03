import { describe, it, expect } from "vitest";
import { moveCommandsForOrder } from "../../lib/timelineCommands";
import type { TimelineItem } from "../../api/types";

const ITEMS: TimelineItem[] = [
  { id: "c1", start_sec: 0, duration_sec: 5 },
  { id: "c2", start_sec: 5, duration_sec: 3 },
  { id: "c3", start_sec: 8, duration_sec: 4 },
];

describe("moveCommandsForOrder", () => {
  it("returns a move command per item with accumulated start_sec", () => {
    const commands = moveCommandsForOrder("video_1", ITEMS);
    expect(commands).toEqual([
      { type: "move", track_id: "video_1", item_id: "c1", new_start_sec: 0 },
      { type: "move", track_id: "video_1", item_id: "c2", new_start_sec: 5 },
      { type: "move", track_id: "video_1", item_id: "c3", new_start_sec: 8 },
    ]);
  });

  it("reflects a reordered array with recomputed start_sec", () => {
    const reordered = [ITEMS[2], ITEMS[0], ITEMS[1]];
    const commands = moveCommandsForOrder("video_1", reordered);
    expect(commands).toEqual([
      { type: "move", track_id: "video_1", item_id: "c3", new_start_sec: 0 },
      { type: "move", track_id: "video_1", item_id: "c1", new_start_sec: 4 },
      { type: "move", track_id: "video_1", item_id: "c2", new_start_sec: 9 },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(moveCommandsForOrder("video_1", [])).toEqual([]);
  });
});
