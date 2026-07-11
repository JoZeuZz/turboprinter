import { describe, it, expect } from "vitest";
import { orientationForAspect } from "../../lib/mediaOrientation";

describe("orientationForAspect", () => {
  it("maps 16:9 to landscape", () => {
    expect(orientationForAspect("16:9")).toBe("landscape");
  });

  it("maps 9:16 to portrait", () => {
    expect(orientationForAspect("9:16")).toBe("portrait");
  });

  it("maps 1:1 to square", () => {
    expect(orientationForAspect("1:1")).toBe("square");
  });

  it("defaults to portrait when aspect is undefined", () => {
    expect(orientationForAspect(undefined)).toBe("portrait");
  });
});
