// webui-react/src/__tests__/pages/Jobs.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Jobs } from "../../pages/Jobs";
import { useJobsStore } from "../../store/useJobsStore";
import type { Job } from "../../api/types";

const pendingJob: Job = {
  id: "job-1", type: "render_project", status: "pending",
  workspace_id: null, project_id: "p1", payload: {},
  scheduled_at: "2026-01-01T00:00:00Z", started_at: null, completed_at: null,
  attempts: 0, max_attempts: 3, last_error: null,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

const failedJob: Job = {
  ...pendingJob, id: "job-2", status: "failed", last_error: "boom",
};

beforeEach(() => {
  useJobsStore.setState({
    jobs: [pendingJob, failedJob],
    loading: false,
    error: null,
    refresh: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    runFullPipeline: vi.fn(),
  });
});

describe("Jobs page", () => {
  it("renders jobs grouped by status", () => {
    render(<Jobs />);
    expect(screen.getByText("job-1")).toBeInTheDocument();
    expect(screen.getByText("job-2")).toBeInTheDocument();
    expect(screen.getByText("boom")).toBeInTheDocument();
  });

  it("calls refresh on mount", () => {
    render(<Jobs />);
    expect(useJobsStore.getState().refresh).toHaveBeenCalled();
  });

  it("cancel button calls store.cancel for a pending job", async () => {
    render(<Jobs />);
    const user = userEvent.setup();
    const cancelButtons = screen.getAllByRole("button", { name: /cancel/i });
    await user.click(cancelButtons[0]);
    await waitFor(() => {
      expect(useJobsStore.getState().cancel).toHaveBeenCalledWith("job-1");
    });
  });
});
