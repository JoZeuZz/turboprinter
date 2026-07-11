// webui-react/src/__tests__/store/useVideoStore.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { useVideoStore } from "../../store/useVideoStore";

beforeEach(() => {
  sessionStorage.clear();
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

  it("toParams() excludes tts_provider", () => {
    const params = useVideoStore.getState().toParams();
    expect("tts_provider" in params).toBe(false);
  });

  it("reset() restores defaults", () => {
    act(() => useVideoStore.getState().set("video_subject", "dogs"));
    act(() => useVideoStore.getState().reset());
    expect(useVideoStore.getState().video_subject).toBe("");
  });
});

describe("useVideoStore persistence", () => {
  it("persists video_subject to sessionStorage", () => {
    act(() => useVideoStore.getState().set("video_subject", "Test topic"));
    const raw = sessionStorage.getItem("mpt-video");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.video_subject).toBe("Test topic");
  });

  it("persists tts_provider", () => {
    act(() => useVideoStore.getState().set("tts_provider", "siliconflow"));
    const raw = sessionStorage.getItem("mpt-video");
    const parsed = JSON.parse(raw!);
    expect(parsed.state.tts_provider).toBe("siliconflow");
  });

  it("reset clears tts_provider back to default", () => {
    act(() => {
      useVideoStore.getState().set("tts_provider", "gemini-tts");
      useVideoStore.getState().reset();
    });
    expect(useVideoStore.getState().tts_provider).toBe("azure-tts-v1");
  });
});
