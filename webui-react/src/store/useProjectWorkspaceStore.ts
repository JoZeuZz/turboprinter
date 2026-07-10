// webui-react/src/store/useProjectWorkspaceStore.ts
import { create } from "zustand";
import i18n from "../i18n";
import { persist, createJSONStorage } from "zustand/middleware";
import { videoApi } from "../api/video";
import { pollTask } from "../api/polling";
import { useProjectHistoryStore } from "./useProjectHistoryStore";
import type { TaskStatus, VideoParams } from "../api/types";
import type { WorkspacePanel } from "../types/workspace";

export function finalVideoUrls(status: TaskStatus | null): string[] {
  // `combined_videos` are intermediate clips without the final subtitle/audio
  // pass. They must never unlock the review or finalization stages.
  return [...new Set((status?.videos ?? []).filter(isFinalVideoUrl))];
}

export function isFinalVideoUrl(url: string): boolean {
  return /\/final-\d+\.mp4(?:[?#].*)?$/i.test(url);
}

interface WorkspaceStoreState {
  panel: WorkspacePanel;
  topic: string;
  taskId: string | null;
  taskStatus: TaskStatus | null;
  error: string | null;
  videoUrls: string[];
  setTopic: (topic: string) => void;
  setPanel: (panel: WorkspacePanel) => void;
  generateVideo: (params: VideoParams) => Promise<void>;
  reset: () => void;
}

const INITIAL: Omit<
  WorkspaceStoreState,
  "setTopic" | "setPanel" | "generateVideo" | "reset"
> = {
  panel: "script",
  topic: "",
  taskId: null,
  taskStatus: null,
  error: null,
  videoUrls: [],
};

export const useProjectWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setTopic: (topic) => set({ topic }),

      setPanel: (panel) => set({ panel }),

      generateVideo: async (params: VideoParams) => {
        set({ panel: "generating", error: null, taskStatus: null, videoUrls: [] });
        try {
          const { task_id } = await videoApi.createTask(params);
          const { currentDraftId, removeDraft } = useProjectHistoryStore.getState();
          removeDraft(currentDraftId);
          set({ taskId: task_id });
          await pollTask(task_id, (status: TaskStatus) => {
            set({ taskStatus: status });
          });
          // pollTask resolves on TASK_STATE_COMPLETE (throws on TASK_STATE_FAILED)
          // After successful completion, retrieve final taskStatus to get video URLs
          set((state) => {
            const status = state.taskStatus;
            const videoUrls = finalVideoUrls(status);
            if (videoUrls.length === 0) {
              return {
                panel: "config",
                videoUrls: [],
                error: i18n.t("errors.noFinalVideo"),
              };
            }
            return { panel: "review", videoUrls, error: null };
          });
        } catch (e) {
          set({
            panel: "config",
            error: e instanceof Error ? e.message : i18n.t("errors.generationFailed"),
          });
        }
      },

      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "mpt-workspace",
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => {
        // Exclude taskStatus — it's ephemeral polling state
        const { taskStatus: _ts, ...rest } = state;
        return rest;
      },
    }
  )
);
