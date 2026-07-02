import { describe, expect, it } from "vitest";
import { resolveStatus } from "../../lib/statusBadge";

describe("resolveStatus", () => {
  it("loading mode overrides phase", () => {
    expect(resolveStatus("loading", "done")).toEqual({ kind: "loading" });
  });
  it("disabled mode is offline", () => {
    expect(resolveStatus("disabled", "script")).toEqual({ kind: "offline" });
  });
  it("error mode is error", () => {
    expect(resolveStatus("error", "review")).toEqual({ kind: "error" });
  });
  it("idle/ready fall through to phase", () => {
    expect(resolveStatus("idle", "script")).toEqual({ kind: "phase", panel: "script" });
    expect(resolveStatus("ready", "done")).toEqual({ kind: "phase", panel: "done" });
  });
});
