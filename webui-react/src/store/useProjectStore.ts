// webui-react/src/store/useProjectStore.ts
import { create } from "zustand";
import { ApiError } from "../api/client";
import { projectsApi } from "../api/projects";
import {
  TASK_STATE_COMPLETE,
  TASK_STATE_FAILED,
  type CreateFromTopicRequest,
  type MediaSearchRequest,
  type PlanRequest,
  type RenderRequest,
  type RenderStatusResponse,
  type TimelineBuildRequest,
  type TimelineProject,
} from "../api/types";

type ProjectMode = "idle" | "loading" | "ready" | "disabled" | "error";

interface ProjectStoreState {
  projectId: string | null;
  project: TimelineProject | null;
  mode: ProjectMode;
  error: string | null;
  renderStatus: RenderStatusResponse | null;
  create: (params: CreateFromTopicRequest) => Promise<void>;
  plan: (params?: PlanRequest) => Promise<void>;
  mediaSearch: (params?: MediaSearchRequest) => Promise<void>;
  buildTimeline: (params?: TimelineBuildRequest) => Promise<void>;
  render: (params?: RenderRequest) => Promise<void>;
  pollRenderStatus: (intervalMs?: number) => Promise<RenderStatusResponse>;
  reset: () => void;
}

const initialState = {
  projectId: null,
  project: null,
  mode: "idle" as ProjectMode,
  error: null,
  renderStatus: null,
};

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export const useProjectStore = create<ProjectStoreState>((set, get) => {
  const fail = (error: unknown) => {
    if (error instanceof ApiError && error.status === 404) {
      set({ mode: "disabled", error: error.message });
      return;
    }
    set({ mode: "error", error: error instanceof Error ? error.message : "Project action failed" });
  };

  const requireProjectId = () => {
    const { projectId } = get();
    if (!projectId) {
      throw new Error("Create a project first");
    }
    return projectId;
  };

  const refresh = async (projectId: string) => {
    const state = await projectsApi.getProject(projectId);
    set({ project: state.timeline ?? null, mode: "ready", error: null });
  };

  return {
    ...initialState,
    create: async (params) => {
      set({ mode: "loading", error: null });
      try {
        const { project_id } = await projectsApi.createFromTopic(params);
        set({ projectId: project_id });
        await refresh(project_id);
      } catch (error) {
        fail(error);
      }
    },
    plan: async (params = {}) => {
      set({ mode: "loading", error: null });
      try {
        const projectId = requireProjectId();
        await projectsApi.planProject(projectId, params);
        await refresh(projectId);
      } catch (error) {
        fail(error);
      }
    },
    mediaSearch: async (params = {}) => {
      set({ mode: "loading", error: null });
      try {
        const projectId = requireProjectId();
        await projectsApi.mediaSearch(projectId, params);
        await refresh(projectId);
      } catch (error) {
        fail(error);
      }
    },
    buildTimeline: async (params = {}) => {
      set({ mode: "loading", error: null });
      try {
        const projectId = requireProjectId();
        await projectsApi.buildTimeline(projectId, params);
        await refresh(projectId);
      } catch (error) {
        fail(error);
      }
    },
    render: async (params = {}) => {
      set({ mode: "loading", error: null });
      try {
        const projectId = requireProjectId();
        await projectsApi.startRender(projectId, params);
        await get().pollRenderStatus();
      } catch (error) {
        fail(error);
      }
    },
    pollRenderStatus: async (intervalMs = 1500) => {
      const projectId = requireProjectId();

      for (;;) {
        const status = await projectsApi.getRenderStatus(projectId);
        set({ renderStatus: status, mode: "ready", error: null });
        if (status.state === TASK_STATE_COMPLETE || status.state === TASK_STATE_FAILED) {
          return status;
        }
        await delay(intervalMs);
      }
    },
    reset: () => set({ ...initialState }),
  };
});
