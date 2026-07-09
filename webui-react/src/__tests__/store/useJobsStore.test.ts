import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jobsApi } from "../../api/jobs";
import { useJobsStore } from "../../store/useJobsStore";
import type { Job } from "../../api/types";

vi.mock("../../api/jobs", () => ({
  jobsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    cancel: vi.fn(),
    runFullPipeline: vi.fn(),
  },
}));

const job1: Job = {
  id: "job-1", type: "render_project", status: "pending",
  workspace_id: null, project_id: "p1", payload: {},
  scheduled_at: "2026-01-01T00:00:00Z", started_at: null, completed_at: null,
  attempts: 0, max_attempts: 3, last_error: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  useJobsStore.setState({ jobs: [], loading: false, error: null });
});

describe("useJobsStore", () => {
  it("refresh populates jobs", async () => {
    vi.mocked(jobsApi.list).mockResolvedValue({ jobs: [job1] });
    await act(async () => {
      await useJobsStore.getState().refresh();
    });
    expect(useJobsStore.getState().jobs).toEqual([job1]);
    expect(useJobsStore.getState().loading).toBe(false);
  });

  it("refresh sets error on failure", async () => {
    vi.mocked(jobsApi.list).mockRejectedValue(new Error("boom"));
    await act(async () => {
      await useJobsStore.getState().refresh();
    });
    expect(useJobsStore.getState().error).toBe("boom");
  });

  it("cancel replaces the job in state", async () => {
    useJobsStore.setState({ jobs: [job1] });
    const cancelled = { ...job1, status: "cancelled" as const };
    vi.mocked(jobsApi.cancel).mockResolvedValue({ job: cancelled });
    await act(async () => {
      await useJobsStore.getState().cancel("job-1");
    });
    expect(useJobsStore.getState().jobs[0].status).toBe("cancelled");
  });

  it("runFullPipeline delegates to jobsApi", async () => {
    vi.mocked(jobsApi.runFullPipeline).mockResolvedValue({
      job_id: "job-2", project_id: "p2",
    });
    const result = await useJobsStore
      .getState()
      .runFullPipeline("ws-1", { topic: "cats", language: "es" });
    expect(result).toEqual({ job_id: "job-2", project_id: "p2" });
  });
});
