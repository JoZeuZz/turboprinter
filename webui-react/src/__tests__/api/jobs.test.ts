import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobsApi } from "../../api/jobs";

const okResponse = (data: unknown) =>
  ({
    ok: true,
    json: async () => ({ status: 200, message: "success", data }),
  }) as Response;

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = vi.fn().mockResolvedValue(okResponse({ jobs: [] }));
});

describe("jobsApi", () => {
  it("list calls GET /jobs with no filters", async () => {
    await jobsApi.list();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/jobs",
      expect.objectContaining({})
    );
  });

  it("list appends query params for filters", async () => {
    await jobsApi.list({ status: "pending" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/jobs?status=pending",
      expect.objectContaining({})
    );
  });

  it("get calls GET /jobs/:id", async () => {
    await jobsApi.get("job-1");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/jobs/job-1",
      expect.objectContaining({})
    );
  });

  it("create posts to /jobs", async () => {
    await jobsApi.create({ type: "render_project" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/jobs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ type: "render_project" }),
      })
    );
  });

  it("cancel posts to /jobs/:id/cancel", async () => {
    await jobsApi.cancel("job-1");
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/jobs/job-1/cancel",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("runFullPipeline posts to /workspaces/:id/run-full-pipeline", async () => {
    await jobsApi.runFullPipeline("ws-1", { topic: "cats", language: "es" });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/v1/workspaces/ws-1/run-full-pipeline",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ topic: "cats", language: "es" }),
      })
    );
  });
});
