// webui-react/src/__tests__/api/polling.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pollTask } from "../../api/polling";
import { TASK_STATE_COMPLETE, TASK_STATE_FAILED, TASK_STATE_PROCESSING } from "../../api/types";

vi.mock("../../api/client", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "../../api/client";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("pollTask", () => {
  it("resolves when task reaches COMPLETE", async () => {
    const mockFetch = vi.mocked(apiFetch);
    mockFetch
      .mockResolvedValueOnce({ state: TASK_STATE_PROCESSING, progress: 50, videos: [], combined_videos: [] })
      .mockResolvedValueOnce({ state: TASK_STATE_COMPLETE, progress: 100, videos: ["/tasks/abc/final-1.mp4"], combined_videos: [] });

    const onProgress = vi.fn();
    const promise = pollTask("abc", onProgress, 100);

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.state).toBe(TASK_STATE_COMPLETE);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it("rejects when task reaches FAILED", async () => {
    const mockFetch = vi.mocked(apiFetch);
    mockFetch.mockResolvedValue({ state: TASK_STATE_FAILED, progress: 0, videos: [], combined_videos: [] });

    const promise = pollTask("abc", vi.fn(), 100);
    // Attach rejection handler before running timers to avoid unhandled rejection
    const expectReject = expect(promise).rejects.toThrow("Task failed on server");
    await vi.runAllTimersAsync();
    await expectReject;
  });
});
