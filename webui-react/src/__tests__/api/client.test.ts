// webui-react/src/__tests__/api/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, ApiError } from "../../api/client";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("apiFetch", () => {
  it("returns data on 200 response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 200, message: "success", data: { task_id: "abc" } }),
    } as Response);

    const result = await apiFetch<{ task_id: string }>("/videos", { method: "POST", body: "{}" });
    expect(result.task_id).toBe("abc");
  });

  it("throws ApiError on 4xx response body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 422, message: "validation error" }),
    } as Response);

    await expect(apiFetch("/videos")).rejects.toThrow(ApiError);
    await expect(apiFetch("/videos")).rejects.toMatchObject({ status: 422 });
  });
});
