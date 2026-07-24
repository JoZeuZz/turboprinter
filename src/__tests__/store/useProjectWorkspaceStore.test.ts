// webui-react/src/__tests__/store/useProjectWorkspaceStore.test.ts
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

beforeEach(() => {
  useProjectWorkspaceStore.getState().reset();
});

describe("useProjectWorkspaceStore", () => {
  it("starts in script panel", () => {
    expect(useProjectWorkspaceStore.getState().panel).toBe("script");
  });

  it("starts with empty topic, no error and no videos", () => {
    const state = useProjectWorkspaceStore.getState();
    expect(state.topic).toBe("");
    expect(state.error).toBeNull();
    expect(state.videoUrls).toEqual([]);
  });

  it("does not expose the legacy task-mode API", () => {
    const state = useProjectWorkspaceStore.getState() as unknown as Record<string, unknown>;
    expect(state.generateVideo).toBeUndefined();
    expect(state.taskId).toBeUndefined();
    expect(state.taskStatus).toBeUndefined();
  });

  it("setTopic updates topic", () => {
    act(() => useProjectWorkspaceStore.getState().setTopic("Morning exercise"));
    expect(useProjectWorkspaceStore.getState().topic).toBe("Morning exercise");
  });

  it("setPanel transitions panel", () => {
    act(() => useProjectWorkspaceStore.getState().setPanel("config"));
    expect(useProjectWorkspaceStore.getState().panel).toBe("config");
  });

  it("reset returns to initial state", () => {
    act(() => {
      useProjectWorkspaceStore.getState().setTopic("Some topic");
      useProjectWorkspaceStore.getState().setPanel("config");
      useProjectWorkspaceStore.getState().reset();
    });
    const state = useProjectWorkspaceStore.getState();
    expect(state.panel).toBe("script");
    expect(state.topic).toBe("");
    expect(state.error).toBeNull();
    expect(state.videoUrls).toEqual([]);
  });
});
