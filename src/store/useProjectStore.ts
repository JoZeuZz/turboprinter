// webui-react/src/store/useProjectStore.ts
import { create } from "zustand";
import i18n from "../i18n";
import { persist, createJSONStorage } from "zustand/middleware";
import { ApiError } from "../api/client";
import { pollUntilComplete } from "../api/polling";
import { projectsApi } from "../api/projects";
import {
  TASK_STATE_COMPLETE,
  TASK_STATE_FAILED,
  type CreateFromTopicRequest,
  type GetProjectResponse,
  type MediaSearchRequest,
  type PlanRequest,
  type RenderRequest,
  type RenderStatusResponse,
  type TimelineCommandsRequest,
  type TimelineBuildRequest,
  type TimelineProject,
  type VideoParams,
} from "../api/types";
import { orientationForAspect } from "../lib/mediaOrientation";
import { useProjectWorkspaceStore } from "./useProjectWorkspaceStore";

type ProjectMode = "idle" | "loading" | "ready" | "disabled" | "error";
type OrchestrationStep = "plan" | "media" | "narration" | "timeline" | null;

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
  orchestrationStep: OrchestrationStep;
  open: (projectId: string) => Promise<GetProjectResponse>;
  create: (params: CreateFromTopicRequest) => Promise<void>;
  plan: (params?: PlanRequest) => Promise<void>;
  mediaSearch: (params?: MediaSearchRequest) => Promise<void>;
  buildTimeline: (params?: TimelineBuildRequest) => Promise<void>;
  applyTimelineCommands: (params: TimelineCommandsRequest) => Promise<void>;
  render: (params?: RenderRequest) => Promise<void>;
  pollRenderStatus: (intervalMs?: number) => Promise<RenderStatusResponse>;
  generateViaProjectMode: (params: VideoParams) => Promise<void>;
  reset: () => void;
}

const initialState = {
  projectId: null,
  project: null,
  mode: "idle" as ProjectMode,
  error: null,
  renderStatus: null,
  timelineValidation: null,
  orchestrationStep: null as OrchestrationStep,
};

export const useProjectStore = create<ProjectStoreState>()(
  persist(
    (set, get) => {
      const fail = (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          set({ mode: "disabled", error: error.message });
          return;
        }
        set({ mode: "error", error: error instanceof Error ? error.message : i18n.t("errors.projectAction") });
      };

      const requireProjectId = () => {
        const { projectId } = get();
        if (!projectId) {
          throw new Error(i18n.t("errors.createFirst"));
        }
        return projectId;
      };

      const refresh = async (projectId: string) => {
        const state = await projectsApi.getProject(projectId);
        set({ project: state.timeline ?? null, mode: "ready", error: null });
      };

      return {
        ...initialState,
        open: async (projectId) => {
          set({ mode: "loading", error: null });
          try {
            const state = await projectsApi.getProject(projectId);
            set({
              projectId,
              project: state.timeline ?? null,
              mode: "ready",
              error: null,
              timelineValidation: null,
            });
            return state;
          } catch (error) {
            fail(error);
            throw error;
          }
        },
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
          const { timelineValidation } = get();
          if (timelineValidation?.valid === false) {
            set({ mode: "error", error: timelineValidation.errors[0] ?? i18n.t("errors.timelineInvalid") });
            return;
          }
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
            set({ mode: "error", error: status.error ?? i18n.t("errors.renderFailed") });
          } else {
            set({ mode: "ready", error: null });
            if (status.output_path) {
              useProjectWorkspaceStore.setState({
                videoUrls: [status.output_path],
              });
            }
          }

          return status;
        },
        generateViaProjectMode: async (params) => {
          // Clear any stale non-project task state to avoid false triggers
          useProjectWorkspaceStore.setState({ taskId: null, taskStatus: null, error: null, videoUrls: [] });
          set({ mode: "loading", error: null, orchestrationStep: "plan" });
          try {
            const projectId = requireProjectId();
            await projectsApi.planProject(projectId, {});
            set({ orchestrationStep: "media" });
            await projectsApi.mediaSearch(projectId, {
              orientation: orientationForAspect(params.video_aspect),
              prefer_local: false,
            });
            set({ orchestrationStep: "narration" });
            const narration = await projectsApi.synthesizeNarration(projectId, {
              voice_name: params.voice_name,
              voice_rate: params.voice_rate,
              subtitle_enabled: params.subtitle_enabled,
            });
            set({ orchestrationStep: "timeline" });
            await projectsApi.buildTimeline(projectId, {
              narration_audio_path: narration.narration_audio_path,
              subtitle_path: narration.subtitle_path ?? undefined,
            });
            await refresh(projectId);
            useProjectWorkspaceStore.setState({ panel: "editor" });
            set({ orchestrationStep: null });
          } catch (error) {
            fail(error);
          }
        },
        reset: () => set({ ...initialState }),
      };
    },
    {
      name: "mpt-project",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        projectId: state.projectId,
        project: state.project,
      }),
    }
  )
);
