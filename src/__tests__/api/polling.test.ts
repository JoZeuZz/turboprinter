// webui-react/src/__tests__/api/polling.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pollUntilComplete } from "../../api/polling";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("pollUntilComplete", () => {
  it("resolves with the first status that satisfies isComplete", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ state: 4, progress: 50 })
      .mockResolvedValueOnce({ state: 1, progress: 100 });
    const onProgress = vi.fn();

    const promise = pollUntilComplete(
      fetchStatus,
      onProgress,
      (status: { state: number }) => status.state === 1,
      100
    );

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toEqual({ state: 1, progress: 100 });
    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenCalledTimes(2);
  });

  it("reports every intermediate status through onProgress", async () => {
    const fetchStatus = vi
      .fn()
      .mockResolvedValueOnce({ state: 4, progress: 10 })
      .mockResolvedValueOnce({ state: 4, progress: 60 })
      .mockResolvedValueOnce({ state: 1, progress: 100 });
    const onProgress = vi.fn();

    const promise = pollUntilComplete(
      fetchStatus,
      onProgress,
      (status: { state: number }) => status.state === 1,
      100
    );

    await vi.runAllTimersAsync();
    await promise;

    expect(onProgress).toHaveBeenNthCalledWith(1, { state: 4, progress: 10 });
    expect(onProgress).toHaveBeenNthCalledWith(3, { state: 1, progress: 100 });
  });

  it("propagates fetch errors", async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new Error("network down"));

    const promise = pollUntilComplete(fetchStatus, vi.fn(), () => false, 100);
    const expectReject = expect(promise).rejects.toThrow("network down");
    await vi.runAllTimersAsync();
    await expectReject;
  });
});
