import { describe, expect, it } from "vitest";
import {
  resolveRenderStatus,
  shouldSweepProject,
  TASK_STATE_COMPLETE,
  TASK_STATE_FAILED,
} from "../../server/projectLifecycle";

describe("shouldSweepProject", () => {
  it("sweeps a proyecto that was rendered and whose folder was later deleted", () => {
    const project = { project_folder_name: "n/p", videos: ["/x.mp4"] };
    expect(shouldSweepProject(project, false)).toBe(true);
  });

  it("keeps a proyecto that was rendered and whose folder is still intact", () => {
    const project = { project_folder_name: "n/p", videos: ["/x.mp4"] };
    expect(shouldSweepProject(project, true)).toBe(false);
  });

  it("regression: a mid-pipeline proyecto with a folder name and no videos is never swept", () => {
    const project = { project_folder_name: "n/p" };
    expect(shouldSweepProject(project, false)).toBe(false);
  });

  it("does not treat an empty videos array as a completed render", () => {
    const project = { project_folder_name: "n/p", videos: [] };
    expect(shouldSweepProject(project, false)).toBe(false);
  });

  it("does not sweep when there is no folder name to check", () => {
    const project = { videos: ["/x.mp4"] };
    expect(shouldSweepProject(project, false)).toBe(false);
  });

  it("does not sweep a fresh proyecto that has never been touched", () => {
    const project = {};
    expect(shouldSweepProject(project, false)).toBe(false);
  });
});

describe("resolveRenderStatus", () => {
  it("passes through an in-progress task verbatim", () => {
    const task = { state: 4, progress: 55, output_path: null, error: null };
    const result = resolveRenderStatus({ task, project: undefined, renderedFileExists: false });
    expect(result).toEqual({ state: 4, progress: 55, output_path: null, error: null });
  });

  it("passes through a completed task verbatim", () => {
    const task = { state: 1, progress: 100, output_path: "/a.mp4", error: null };
    const result = resolveRenderStatus({ task, project: undefined, renderedFileExists: false });
    expect(result).toEqual({ state: 1, progress: 100, output_path: "/a.mp4", error: null });
  });

  it("passes through a failed task and preserves the error", () => {
    const task = { state: -1, progress: 100, output_path: null, error: "ffmpeg died" };
    const result = resolveRenderStatus({ task, project: undefined, renderedFileExists: false });
    expect(result).toEqual({ state: -1, progress: 100, output_path: null, error: "ffmpeg died" });
  });

  it("reconstructs a completed render from disk when no task exists but the file is still there", () => {
    const project = { videos: ["/storage/renders/n/p/render_x.mp4"] };
    const result = resolveRenderStatus({ task: undefined, project, renderedFileExists: true });
    expect(result.state).toBe(TASK_STATE_COMPLETE);
    expect(result.output_path).toBe("/storage/renders/n/p/render_x.mp4");
  });

  it("reports failure when no task exists and the recorded file is gone", () => {
    const project = { videos: ["/storage/renders/n/p/render_x.mp4"] };
    const result = resolveRenderStatus({ task: undefined, project, renderedFileExists: false });
    expect(result.state).toBe(TASK_STATE_FAILED);
    expect(result.output_path).toBeNull();
    expect(result.error).toBeTruthy();
  });

  it("reports failure when no task exists and the proyecto has no recorded videos", () => {
    const project = { videos: [] };
    const result = resolveRenderStatus({ task: undefined, project, renderedFileExists: false });
    expect(result.state).toBe(TASK_STATE_FAILED);
  });

  it("reports failure without throwing when no task and no proyecto exist", () => {
    const result = resolveRenderStatus({ task: undefined, project: undefined, renderedFileExists: false });
    expect(result.state).toBe(TASK_STATE_FAILED);
    expect(result.output_path).toBeNull();
  });

  it("never reports a stock sample clip as the render output", () => {
    const result = resolveRenderStatus({
      task: undefined,
      project: { videos: [] },
      renderedFileExists: false,
    });
    // Regression: the old fallback returned SAMPLE_VIDEOS[3].source_url with
    // state 1, so a server restart made the UI show "ready" and let the user
    // publish an unrelated Pexels stock clip as their video.
    expect(result.state).toBe(TASK_STATE_FAILED);
    expect(result.output_path).toBeNull();
    expect(String(result.output_path ?? "")).not.toContain("pexels");
  });
});
