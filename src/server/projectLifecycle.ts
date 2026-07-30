// Backend-only pure helpers for two decisions that used to be inlined in
// server.ts and silently destroyed user work:
//   1. whether a proyecto may be swept from the repository, and
//   2. what render status to report when no in-memory task exists.
// Both are I/O-free: the caller performs the filesystem checks and passes the
// results in, which is what makes them unit-testable.

/** The fields of a proyecto these decisions depend on. */
export interface ProjectLifecycleView {
  project_folder_name?: string | null;
  videos?: string[] | null;
}

/** The in-memory render task, when one exists. */
export interface RenderTaskView {
  state: number;
  progress: number;
  output_path?: string | null;
  output_paths?: string[] | null;
  error?: string | null;
}

export interface RenderStatusResult {
  state: number;
  progress: number;
  output_path: string | null;
  output_paths: string[];
  error: string | null;
}

export const TASK_STATE_FAILED = -1;
export const TASK_STATE_COMPLETE = 1;

export const shouldSweepProject = (
  project: ProjectLifecycleView,
  renderFolderExists: boolean
): boolean => {
  if (!project.project_folder_name) return false;
  if (!project.videos || project.videos.length === 0) return false;
  return !renderFolderExists;
};

export const resolveRenderStatus = (args: {
  task: RenderTaskView | undefined;
  project: ProjectLifecycleView | undefined;
  renderedFileExists: boolean;
}): RenderStatusResult => {
  const { task, project, renderedFileExists } = args;

  if (task) {
    const paths = task.output_paths || (task.output_path ? [task.output_path] : []);
    return {
      state: task.state,
      progress: task.progress,
      output_path: task.output_path ?? (paths[0] || null),
      output_paths: paths,
      error: task.error ?? null,
    };
  }

  const recordedUrls = project?.videos || [];
  const recordedUrl = recordedUrls[0];
  if (typeof recordedUrl === "string" && recordedUrl.length > 0 && renderedFileExists) {
    return {
      state: TASK_STATE_COMPLETE,
      progress: 100,
      output_path: recordedUrl,
      output_paths: recordedUrls,
      error: null,
    };
  }

  return {
    state: TASK_STATE_FAILED,
    progress: 100,
    output_path: null,
    output_paths: [],
    error: "No hay un render disponible para este proyecto. Vuelve a renderizar.",
  };
};
