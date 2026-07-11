import { describe, expect, it } from "vitest";
import { deriveVideoOrigin } from "../../lib/videoOrigin";

const base = { routeId: undefined, taskId: null, taskState: null, panel: "script", videoUrls: [] as string[] };

describe("deriveVideoOrigin", () => {
  it("clean /project/new is a draft", () => {
    expect(deriveVideoOrigin({ ...base })).toBe("draft");
  });

  it("generating panel is generating even at /project/new before taskId exists", () => {
    expect(deriveVideoOrigin({ ...base, panel: "generating" })).toBe("generating");
    expect(deriveVideoOrigin({ ...base, panel: "rendering" })).toBe("generating");
  });

  it("session task with a finished video is finished", () => {
    expect(
      deriveVideoOrigin({ ...base, taskId: "t1", panel: "done", videoUrls: ["/v.mp4"] })
    ).toBe("finished");
  });

  it("opened project with no session task is history", () => {
    expect(deriveVideoOrigin({ ...base, routeId: "p1", panel: "review" })).toBe("history");
  });

  it("old finished project from history (videoUrls but no taskId) is history, not finished", () => {
    expect(
      deriveVideoOrigin({ ...base, routeId: "p1", panel: "done", videoUrls: ["/old.mp4"], taskId: null })
    ).toBe("history");
  });
});
