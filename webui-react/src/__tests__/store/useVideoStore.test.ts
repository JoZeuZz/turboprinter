// webui-react/src/__tests__/store/useVideoStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useVideoStore } from "../../store/useVideoStore";

beforeEach(() => {
  act(() => useVideoStore.getState().reset());
});

describe("useVideoStore", () => {
  it("has correct defaults", () => {
    const state = useVideoStore.getState();
    expect(state.video_subject).toBe("");
    expect(state.video_aspect).toBe("9:16");
    expect(state.subtitle_enabled).toBe(true);
  });

  it("set() updates a single field", () => {
    act(() => useVideoStore.getState().set("video_subject", "cats"));
    expect(useVideoStore.getState().video_subject).toBe("cats");
  });

  it("toParams() excludes store actions", () => {
    const params = useVideoStore.getState().toParams();
    expect("set" in params).toBe(false);
    expect("reset" in params).toBe(false);
    expect("toParams" in params).toBe(false);
    expect(params.video_aspect).toBe("9:16");
  });

  it("reset() restores defaults", () => {
    act(() => useVideoStore.getState().set("video_subject", "dogs"));
    act(() => useVideoStore.getState().reset());
    expect(useVideoStore.getState().video_subject).toBe("");
  });
});
