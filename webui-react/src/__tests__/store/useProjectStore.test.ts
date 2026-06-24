// webui-react/src/__tests__/store/useProjectStore.test.ts
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectsApi } from "../../api/projects";
import type { GetProjectResponse } from "../../api/types";
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

const projectWithTimeline: GetProjectResponse = {
  project_id: "project-1",
  has_script: true,
  has_shot_plan: true,
  has_selected_media: true,
  has_timeline: true,
  timeline: {
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
};

beforeEach(() => {
  vi.resetAllMocks();
  useProjectStore.getState().reset();
});

describe("useProjectStore", () => {
  it("runs create, plan, and build using the project client", async () => {
    vi.mocked(projectsApi.createFromTopic).mockResolvedValue({
      project_id: "project-1",
      has_script: true,
    });
    vi.mocked(projectsApi.getProject).mockResolvedValue(projectWithTimeline);
    vi.mocked(projectsApi.planProject).mockResolvedValue({
      project_id: "project-1",
      segment_count: 1,
    });
    vi.mocked(projectsApi.buildTimeline).mockResolvedValue({
      project_id: "project-1",
      track_count: 1,
    });

    await act(async () => {
      await useProjectStore.getState().create({ topic: "cats" });
      await useProjectStore.getState().plan();
      await useProjectStore.getState().buildTimeline({ title: "Cats" });
    });

    expect(projectsApi.createFromTopic).toHaveBeenCalledWith({ topic: "cats" });
    expect(projectsApi.planProject).toHaveBeenCalledWith("project-1", {});
    expect(projectsApi.buildTimeline).toHaveBeenCalledWith("project-1", { title: "Cats" });
    expect(projectsApi.getProject).toHaveBeenCalledTimes(3);
    expect(useProjectStore.getState().projectId).toBe("project-1");
    expect(useProjectStore.getState().project?.tracks[0].items[0].id).toBe("clip-1");
    expect(useProjectStore.getState().mode).toBe("ready");
  });

  it("stores invalid timeline validation after applying commands", async () => {
    useProjectStore.setState({ projectId: "project-1" });
    vi.mocked(projectsApi.applyTimelineCommands).mockResolvedValue({
      project_id: "project-1",
      applied: 1,
      valid: false,
      errors: ["gap before first item"],
    });
    vi.mocked(projectsApi.getProject).mockResolvedValue(projectWithTimeline);

    await act(async () => {
      await useProjectStore.getState().applyTimelineCommands({ commands: [] });
    });

    expect(projectsApi.applyTimelineCommands).toHaveBeenCalledWith(
      "project-1",
      { commands: [] },
      true
    );
    expect(useProjectStore.getState().timelineValidation).toEqual({
      valid: false,
      errors: ["gap before first item"],
    });
  });
});
