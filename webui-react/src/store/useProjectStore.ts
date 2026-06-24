// webui-react/src/store/useProjectStore.ts
import { create } from "zustand";
import { ApiError } from "../api/client";
import { pollUntilComplete } from "../api/polling";
import { projectsApi } from "../api/projects";
import {
  TASK_STATE_COMPLETE,
  TASK_STATE_FAILED,
  type CreateFromTopicRequest,
  type MediaSearchRequest,
  type PlanRequest,
  type RenderRequest,
  type RenderStatusResponse,
  type TimelineCommandsRequest,
  type TimelineBuildRequest,
  type TimelineProject,
} from "../api/types";

type ProjectMode = "idle" | "loading" | "ready" | "disabled" | "error";

interface TimelineValidationState {
  valid: boolean;
  errors: string[];
}

interface ProjectStoreState {
  projectId: string | null;
  project: TimelineProject | null;
  mode: ProjectMode;
  error: string | null;
  renderStatus: RenderStatusResponse | null;
  timelineValidation: TimelineValidationState | null;
  create: (params: CreateFromTopicRequest) => Promise<void>;
  plan: (params?: PlanRequest) => Promise<void>;
  mediaSearch: (params?: MediaSearchRequest) => Promise<void>;
  buildTimeline: (params?: TimelineBuildRequest) => Promise<void>;
  applyTimelineCommands: (params: TimelineCommandsRequest) => Promise<void>;
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
  timelineValidation: null,
};

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
      set({ mode: "loading", error: null, timelineValidation: null });
      try {
        const projectId = requireProjectId();
        await projectsApi.buildTimeline(projectId, params);
        await refresh(projectId);
      } catch (error) {
        fail(error);
      }
    },
    applyTimelineCommands: async (params) => {
      set({ mode: "loading", error: null });
      try {
        const projectId = requireProjectId();
        const response = await projectsApi.applyTimelineCommands(projectId, params, true);
        if (response.valid != null) {
          set({
            timelineValidation: {
              valid: response.valid,
              errors: response.errors ?? [],
            },
          });
        }
        await refresh(projectId);
      } catch (error) {
        fail(error);
      }
    },
    render: async (params = {}) => {
      set({ mode: "loading", error: null });
      try {
        const { timelineValidation } = get();
        if (timelineValidation?.valid === false) {
          throw new Error(timelineValidation.errors[0] ?? "Timeline validation failed");
        }
        const projectId = requireProjectId();
        await projectsApi.startRender(projectId, params);
        await get().pollRenderStatus();
      } catch (error) {
        fail(error);
      }
    },
    pollRenderStatus: async (intervalMs = 1500) => {
      const projectId = requireProjectId();

      set({ mode: "loading", error: null });
      const status = await pollUntilComplete(
        () => projectsApi.getRenderStatus(projectId),
        (nextStatus) => set({ renderStatus: nextStatus, error: null }),
        (nextStatus) =>
          nextStatus.state === TASK_STATE_COMPLETE ||
          nextStatus.state === TASK_STATE_FAILED,
        intervalMs
      );

      if (status.state === TASK_STATE_FAILED) {
        set({ mode: "error", error: status.error ?? "Render failed" });
      } else {
        set({ mode: "ready", error: null });
      }

      return status;
    },
    reset: () => set({ ...initialState }),
  };
});
