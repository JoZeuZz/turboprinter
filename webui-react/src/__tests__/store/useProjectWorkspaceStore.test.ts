// webui-react/src/__tests__/store/useProjectWorkspaceStore.test.ts
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { videoApi } from "../../api/video";
import { pollTask } from "../../api/polling";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

vi.mock("../../api/video", () => ({
  videoApi: {
    createTask: vi.fn(),
  },
}));

vi.mock("../../api/polling", () => ({
  pollTask: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  useProjectWorkspaceStore.getState().reset();
});

describe("useProjectWorkspaceStore", () => {
  it("starts in script panel", () => {
    expect(useProjectWorkspaceStore.getState().panel).toBe("script");
  });

  it("starts with empty topic and null taskId", () => {
    const state = useProjectWorkspaceStore.getState();
    expect(state.topic).toBe("");
    expect(state.taskId).toBeNull();
    expect(state.taskStatus).toBeNull();
    expect(state.error).toBeNull();
    expect(state.videoUrls).toEqual([]);
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
    expect(state.taskId).toBeNull();
    expect(state.error).toBeNull();
    expect(state.videoUrls).toEqual([]);
  });

  it("generateVideo transitions to generating, calls createTask, then done on success", async () => {
    vi.mocked(videoApi.createTask).mockResolvedValue({ task_id: "task-123" });
    vi.mocked(pollTask).mockImplementation(async (_id, onUpdate) => {
      onUpdate({ state: 1, progress: 100, videos: ["/dl/video.mp4"], combined_videos: [] });
      return { state: 1, progress: 100, videos: ["/dl/video.mp4"], combined_videos: [] };
    });

    await act(async () => {
      await useProjectWorkspaceStore.getState().generateVideo({ video_subject: "cats" });
    });

    expect(videoApi.createTask).toHaveBeenCalledWith({ video_subject: "cats" });
    expect(pollTask).toHaveBeenCalledWith("task-123", expect.any(Function));

    const state = useProjectWorkspaceStore.getState();
    expect(state.taskId).toBe("task-123");
    expect(state.panel).toBe("done");
    expect(state.videoUrls).toContain("/dl/video.mp4");
    expect(state.error).toBeNull();
  });

  it("generateVideo goes to config panel and sets error when createTask rejects", async () => {
    vi.mocked(videoApi.createTask).mockRejectedValue(new Error("Network error"));

    await act(async () => {
      await useProjectWorkspaceStore.getState().generateVideo({ video_subject: "cats" });
    });

    const state = useProjectWorkspaceStore.getState();
    expect(state.panel).toBe("config");
    expect(state.error).toBe("Network error");
    expect(state.videoUrls).toEqual([]);
  });

  it("generateVideo goes to config panel on task failure", async () => {
    vi.mocked(videoApi.createTask).mockResolvedValue({ task_id: "task-456" });
    vi.mocked(pollTask).mockImplementation(async (_id, onUpdate) => {
      onUpdate({ state: -1, progress: 0, videos: [], combined_videos: [] });
      throw new Error("Task failed on server");
    });

    await act(async () => {
      await useProjectWorkspaceStore.getState().generateVideo({ video_subject: "failing video" });
    });

    const state = useProjectWorkspaceStore.getState();
    expect(state.panel).toBe("config");
    expect(state.error).toBeTruthy();
  });

  it("generateVideo sets taskStatus from poll callback", async () => {
    vi.mocked(videoApi.createTask).mockResolvedValue({ task_id: "task-789" });
    vi.mocked(pollTask).mockImplementation(async (_id, onUpdate) => {
      onUpdate({ state: 4, progress: 50, videos: [], combined_videos: [] });
      onUpdate({ state: 1, progress: 100, videos: ["/v.mp4"], combined_videos: [] });
      return { state: 1, progress: 100, videos: ["/v.mp4"], combined_videos: [] };
    });

    await act(async () => {
      await useProjectWorkspaceStore.getState().generateVideo({ video_subject: "progress test" });
    });

    const state = useProjectWorkspaceStore.getState();
    expect(state.taskStatus?.state).toBe(1);
    expect(state.taskStatus?.progress).toBe(100);
  });

  it("generateVideo deduplicates combined_videos and videos", async () => {
    vi.mocked(videoApi.createTask).mockResolvedValue({ task_id: "task-dedup" });
    vi.mocked(pollTask).mockImplementation(async (_id, onUpdate) => {
      onUpdate({
        state: 1,
        progress: 100,
        videos: ["/a.mp4", "/b.mp4"],
        combined_videos: ["/a.mp4"],
      });
      return { state: 1, progress: 100, videos: ["/a.mp4", "/b.mp4"], combined_videos: ["/a.mp4"] };
    });

    await act(async () => {
      await useProjectWorkspaceStore.getState().generateVideo({ video_subject: "dedup" });
    });

    const state = useProjectWorkspaceStore.getState();
    expect(state.videoUrls).toEqual(["/a.mp4", "/b.mp4"]);
    // No duplicates
    expect(new Set(state.videoUrls).size).toBe(state.videoUrls.length);
  });
});
