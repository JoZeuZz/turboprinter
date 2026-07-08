// webui-react/src/__tests__/store/useProjectStore.test.ts
import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectsApi } from "../../api/projects";
import type { GetProjectResponse, VideoParams } from "../../api/types";
import { useProjectStore } from "../../store/useProjectStore";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";

vi.mock("../../api/projects", () => ({
  projectsApi: {
    createFromTopic: vi.fn(),
    getProject: vi.fn(),
    planProject: vi.fn(),
    mediaSearch: vi.fn(),
    synthesizeNarration: vi.fn(),
    buildTimeline: vi.fn(),
    applyTimelineCommands: vi.fn(),
    startRender: vi.fn(),
    getRenderStatus: vi.fn(),
    preflight: vi.fn(),
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

  it("render is blocked and sets error when timeline validation is invalid", async () => {
    useProjectStore.setState({
      projectId: "project-1",
      timelineValidation: { valid: false, errors: ["gap before first item"] },
    });

    await act(async () => {
      await useProjectStore.getState().render();
    });

    expect(projectsApi.startRender).not.toHaveBeenCalled();
    expect(useProjectStore.getState().mode).toBe("error");
    expect(useProjectStore.getState().error).toBe("gap before first item");
  });

  it("surfaces the Spanish 'create a project first' error when no project is open", async () => {
    await useProjectStore.getState().plan();
    expect(useProjectStore.getState().error).toBe("Crea un proyecto primero");
  });

  it("generateViaProjectMode runs plan, media, narration, timeline in order and lands on editor panel", async () => {
    useProjectStore.setState({ projectId: "project-1" });
    vi.mocked(projectsApi.planProject).mockResolvedValue({ project_id: "project-1", segment_count: 3 });
    vi.mocked(projectsApi.mediaSearch).mockResolvedValue({ project_id: "project-1", selected_count: 3 });
    vi.mocked(projectsApi.synthesizeNarration).mockResolvedValue({
      project_id: "project-1",
      narration_audio_path: "/tasks/project-1/audio.mp3",
      audio_duration_sec: 12,
      subtitle_path: "/tasks/project-1/_meta/subtitle.srt",
    });
    vi.mocked(projectsApi.buildTimeline).mockResolvedValue({ project_id: "project-1", track_count: 1 });
    vi.mocked(projectsApi.getProject).mockResolvedValue(projectWithTimeline);
    useProjectWorkspaceStore.setState({ panel: "generating" });

    const params: VideoParams = {
      video_subject: "cats", video_aspect: "16:9",
      voice_name: "es-MX-DaliaNeural", voice_rate: 1.1, subtitle_enabled: true,
    };

    await act(async () => {
      await useProjectStore.getState().generateViaProjectMode(params);
    });

    expect(projectsApi.planProject).toHaveBeenCalledWith("project-1", {});
    expect(projectsApi.mediaSearch).toHaveBeenCalledWith("project-1", {
      orientation: "landscape", prefer_local: false,
    });
    expect(projectsApi.synthesizeNarration).toHaveBeenCalledWith("project-1", {
      voice_name: "es-MX-DaliaNeural", voice_rate: 1.1, subtitle_enabled: true,
    });
    expect(projectsApi.buildTimeline).toHaveBeenCalledWith("project-1", {
      narration_audio_path: "/tasks/project-1/audio.mp3",
      subtitle_path: "/tasks/project-1/_meta/subtitle.srt",
    });
    expect(useProjectStore.getState().orchestrationStep).toBeNull();
    expect(useProjectStore.getState().mode).toBe("ready");
    expect(useProjectWorkspaceStore.getState().panel).toBe("editor");
  });

  it("generateViaProjectMode leaves orchestrationStep pointing at the failed step", async () => {
    useProjectStore.setState({ projectId: "project-1" });
    vi.mocked(projectsApi.planProject).mockResolvedValue({ project_id: "project-1", segment_count: 3 });
    vi.mocked(projectsApi.mediaSearch).mockRejectedValue(new Error("no clips found"));

    await act(async () => {
      await useProjectStore.getState().generateViaProjectMode({
        video_subject: "cats", video_aspect: "9:16",
      });
    });

    expect(useProjectStore.getState().orchestrationStep).toBe("media");
    expect(useProjectStore.getState().mode).toBe("error");
    expect(useProjectStore.getState().error).toBe("no clips found");
    expect(projectsApi.synthesizeNarration).not.toHaveBeenCalled();
    expect(projectsApi.buildTimeline).not.toHaveBeenCalled();
  });

  it("populates projectMeta from getProject after open", async () => {
    vi.mocked(projectsApi.getProject).mockResolvedValue({
      project_id: "project-1",
      has_script: true,
      has_shot_plan: true,
      has_selected_media: true,
      has_timeline: true,
      topic: "cats in space",
      workspace_id: "workspace-1",
      prompt_template_id: "template-1",
      prompt_version_id: "version-1",
      provider: "openai",
      model: "gpt-4o",
    });

    await act(async () => {
      await useProjectStore.getState().open("project-1");
    });

    expect(useProjectStore.getState().projectMeta).toEqual({
      topic: "cats in space",
      workspace_id: "workspace-1",
      prompt_template_id: "template-1",
      prompt_version_id: "version-1",
      provider: "openai",
      model: "gpt-4o",
    });
  });

  it("defaults projectMeta fields to null when getProject omits them", async () => {
    vi.mocked(projectsApi.getProject).mockResolvedValue({
      project_id: "project-1",
      has_script: false,
      has_shot_plan: false,
      has_selected_media: false,
      has_timeline: false,
    });

    await act(async () => {
      await useProjectStore.getState().open("project-1");
    });

    expect(useProjectStore.getState().projectMeta).toEqual({
      topic: null,
      workspace_id: null,
      prompt_template_id: null,
      prompt_version_id: null,
      provider: null,
      model: null,
    });
  });

  it("runPreflight stores the result and returns it", async () => {
    useProjectStore.setState({ projectId: "project-1" });
    vi.mocked(projectsApi.preflight).mockResolvedValue({
      project_id: "project-1",
      valid: false,
      errors: ["video track has placeholder/missing clips: item_1"],
      warnings: [],
      summary: "1 error(s), 0 warning(s).",
      checks: [],
    });

    let result;
    await act(async () => {
      result = await useProjectStore.getState().runPreflight();
    });

    expect(projectsApi.preflight).toHaveBeenCalledWith("project-1");
    expect(useProjectStore.getState().preflightResult?.valid).toBe(false);
    expect(result).toEqual(useProjectStore.getState().preflightResult);
  });
});
