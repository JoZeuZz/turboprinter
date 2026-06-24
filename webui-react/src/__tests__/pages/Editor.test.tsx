// webui-react/src/__tests__/pages/Editor.test.tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { Editor } from "../../pages/Editor";
import { useProjectStore } from "../../store/useProjectStore";

vi.mock("../../api/projects", () => ({
  projectsApi: {
    createFromTopic: vi.fn(),
    getProject: vi.fn(),
    planProject: vi.fn(),
    mediaSearch: vi.fn(),
    buildTimeline: vi.fn(),
    applyTimelineCommands: vi.fn(),
    startRender: vi.fn(),
    getRenderStatus: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  act(() => useProjectStore.getState().reset());
});

describe("Editor", () => {
  it("shows a disabled project-mode message on 404", async () => {
    vi.mocked(projectsApi.createFromTopic).mockRejectedValue(
      new ApiError(404, "project mode disabled")
    );

    render(<Editor />);
    await userEvent.type(screen.getByLabelText(/topic/i), "cats");
    await userEvent.click(screen.getByRole("button", { name: /create project/i }));

    expect(
      await screen.findByText(/Project mode is disabled/i)
    ).toBeInTheDocument();
  });

  it("renders timeline clips from the project store", () => {
    act(() => {
      useProjectStore.setState({
        projectId: "project-1",
        mode: "ready",
        project: {
          project_id: "project-1",
          tracks: [
            {
              id: "video",
              type: "video",
              name: "Video",
              items: [{ id: "clip-1", start_sec: 0, duration_sec: 5 }],
            },
          ],
        },
      });
    });

    render(<Editor />);

    expect(screen.getByText("clip-1")).toBeInTheDocument();
    expect(screen.getByText(/0.0s - 5.0s/)).toBeInTheDocument();
  });

  it("shows validation errors and disables render", () => {
    act(() => {
      useProjectStore.setState({
        projectId: "project-1",
        mode: "ready",
        timelineValidation: { valid: false, errors: ["gap before first item"] },
        project: {
          project_id: "project-1",
          tracks: [
            {
              id: "video",
              type: "video",
              name: "Video",
              items: [{ id: "clip-1", start_sec: 0, duration_sec: 5 }],
            },
          ],
        },
      });
    });

    render(<Editor />);

    expect(screen.getByText(/gap before first item/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /render/i })).toBeDisabled();
  });
});
