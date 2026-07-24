import { describe, expect, it } from "vitest";
import { deriveVideoOrigin } from "../../lib/videoOrigin";

const base = { routeId: undefined, panel: "script", videoUrls: [] as string[] };

describe("deriveVideoOrigin", () => {
  it("clean /project/new is a draft", () => {
    expect(deriveVideoOrigin({ ...base })).toBe("draft");
  });

  it("generating and rendering panels are generating", () => {
    expect(deriveVideoOrigin({ ...base, panel: "generating" })).toBe("generating");
    expect(deriveVideoOrigin({ ...base, panel: "rendering" })).toBe("generating");
  });

  it("done panel with a fresh video is finished", () => {
    expect(deriveVideoOrigin({ ...base, panel: "done", videoUrls: ["/v.mp4"] })).toBe("finished");
    expect(
      deriveVideoOrigin({ ...base, routeId: "p1", panel: "done", videoUrls: ["/v.mp4"] })
    ).toBe("finished");
  });

  it("opened project with no active generation is history", () => {
    expect(deriveVideoOrigin({ ...base, routeId: "p1", panel: "review" })).toBe("history");
  });

  it("stale videoUrls outside the done panel do not mark finished", () => {
    expect(
      deriveVideoOrigin({ ...base, routeId: "p1", panel: "editor", videoUrls: ["/old.mp4"] })
    ).toBe("history");
  });
});
