// webui-react/src/__tests__/api/projects.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { projectsApi } from "../../api/projects";
import type { TimelineProject } from "../../api/types";

const okResponse = (data: unknown) =>
  ({
    ok: true,
    json: async () => ({ status: 200, message: "success", data }),
  }) as Response;

const timeline: TimelineProject = {
  project_id: "project-1",
  tracks: [
    {
      id: "video",
      type: "video",
      name: "Video",
      items: [{ id: "clip-1", start_sec: 0, duration_sec: 5 }],
    },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = vi.fn().mockResolvedValue(okResponse({ project_id: "project-1" }));
});

describe("projectsApi", () => {
  it.each([
    {
      name: "createFromTopic",
      call: () => projectsApi.createFromTopic({ topic: "cats" }),
      path: "/api/v1/projects/from-topic",
      method: "POST",
      body: { topic: "cats" },
    },
    {
      name: "createFromScript",
      call: () => projectsApi.createFromScript({ script: "hello" }),
      path: "/api/v1/projects/from-script",
      method: "POST",
      body: { script: "hello" },
    },
    {
      name: "createFromReddit",
      call: () => projectsApi.createFromReddit({ body: "post" }),
      path: "/api/v1/projects/from-reddit",
      method: "POST",
      body: { body: "post" },
    },
    {
      name: "getProject",
      call: () => projectsApi.getProject("project-1"),
      path: "/api/v1/projects/project-1",
      method: "GET",
    },
    {
      name: "planProject",
      call: () => projectsApi.planProject("project-1", { target_duration_sec: 30 }),
      path: "/api/v1/projects/project-1/plan",
      method: "POST",
      body: { target_duration_sec: 30 },
    },
    {
      name: "mediaSearch",
      call: () => projectsApi.mediaSearch("project-1", { orientation: "portrait" }),
      path: "/api/v1/projects/project-1/media/search",
      method: "POST",
      body: { orientation: "portrait" },
    },
    {
      name: "buildTimeline",
      call: () => projectsApi.buildTimeline("project-1", { title: "Cats" }),
      path: "/api/v1/projects/project-1/timeline/build",
      method: "POST",
      body: { title: "Cats" },
    },
    {
      name: "applyTimelineCommands",
      call: () =>
        projectsApi.applyTimelineCommands("project-1", {
          commands: [
            { type: "move", track_id: "video", item_id: "clip-1", new_start_sec: 2 },
          ],
        }),
      path: "/api/v1/projects/project-1/timeline/commands",
      method: "POST",
      body: {
        commands: [
          { type: "move", track_id: "video", item_id: "clip-1", new_start_sec: 2 },
        ],
      },
    },
    {
      name: "validateTimeline",
      call: () => projectsApi.validateTimeline("project-1"),
      path: "/api/v1/projects/project-1/timeline/validate",
      method: "POST",
    },
    {
      name: "selectMusic",
      call: () => projectsApi.selectMusic("project-1", { mood: "hopeful" }),
      path: "/api/v1/projects/project-1/music/select",
      method: "POST",
      body: { mood: "hopeful" },
    },
    {
      name: "getMusic",
      call: () => projectsApi.getMusic("project-1"),
      path: "/api/v1/projects/project-1/music",
      method: "GET",
    },
    {
      name: "replaceTimeline",
      call: () => projectsApi.replaceTimeline("project-1", timeline),
      path: "/api/v1/projects/project-1",
      method: "PUT",
      body: timeline,
    },
    {
      name: "startRender",
      call: () => projectsApi.startRender("project-1", { renderer: "moviepy" }),
      path: "/api/v1/projects/project-1/render",
      method: "POST",
      body: { renderer: "moviepy" },
    },
    {
      name: "getRenderStatus",
      call: () => projectsApi.getRenderStatus("project-1"),
      path: "/api/v1/projects/project-1/render",
      method: "GET",
    },
    {
      name: "listAssets",
      call: () => projectsApi.listAssets("project-1"),
      path: "/api/v1/projects/project-1/assets",
      method: "GET",
    },
  ])("$name hits the expected endpoint and unwraps data", async ({ call, path, method, body }) => {
    const result = await call();

    expect(result).toEqual({ project_id: "project-1" });
    expect(fetch).toHaveBeenCalledWith(
      path,
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        ...(method === "GET" ? {} : { method }),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
    );
  });

  it("surfaces disabled project mode as ApiError status 404", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 404, message: "project mode disabled" }),
    } as Response);

    await expect(projectsApi.createFromTopic({ topic: "cats" })).rejects.toThrow(ApiError);
    await expect(projectsApi.createFromTopic({ topic: "cats" })).rejects.toMatchObject({
      status: 404,
      message: "project mode disabled",
    });
  });
});
