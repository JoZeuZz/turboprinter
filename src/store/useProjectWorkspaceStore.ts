// webui-react/src/store/useProjectWorkspaceStore.ts
import { create } from "zustand";
import i18n from "../i18n";
import { persist, createJSONStorage } from "zustand/middleware";
import { videoApi } from "../api/video";
import { pollTask } from "../api/polling";
import { useProjectHistoryStore } from "./useProjectHistoryStore";
import type { TaskStatus, VideoParams } from "../api/types";
import type { WorkspacePanel } from "../types/workspace";

function finalVideoUrls(status: TaskStatus | null): string[] {
  const urls = status?.videos?.length ? status.videos : status?.combined_videos ?? [];
  return [...new Set(urls)];
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
        console.log("[WorkspaceStore] generateVideo started with params:", params);
        set({ panel: "generating", error: null, taskStatus: null, videoUrls: [] });
        console.log("[WorkspaceStore] Panel transition set: 'generating', cleared previous error and taskStatus");

        try {
          console.log("[WorkspaceStore] Initiating videoApi.createTask request...");
          const { task_id } = await videoApi.createTask(params);
          console.log("[WorkspaceStore] videoApi.createTask succeeded. Received task_id:", task_id);

          const { currentDraftId, removeDraft } = useProjectHistoryStore.getState();
          console.log("[WorkspaceStore] Removing draft from history. currentDraftId:", currentDraftId);
          removeDraft(currentDraftId);

          set({ taskId: task_id });
          console.log("[WorkspaceStore] Task ID saved in store. Starting polling...");

          await pollTask(task_id, (status: TaskStatus) => {
            console.log("[WorkspaceStore] Polling update received for task:", task_id, {
              state: status.state,
              progress: status.progress,
              videoCount: status.videos?.length ?? 0,
              logsCount: status.logs?.length ?? 0
            });
            set({ taskStatus: status });
          });

          console.log("[WorkspaceStore] pollTask resolved successfully. Transitioning to 'done'...");
          set((state) => {
            const status = state.taskStatus;
            const urls = finalVideoUrls(status);
            console.log("[WorkspaceStore] Final videos found for review:", urls);
            return { panel: "done", videoUrls: urls };
          });
        } catch (e) {
          console.error("[WorkspaceStore] generateVideo failed during async lifecycle!", e);
          const errorMsg = e instanceof Error ? e.message : i18n.t("errors.generationFailed");
          console.log("[WorkspaceStore] Reverting panel back to 'config' due to error:", errorMsg);
          set({
            panel: "config",
            error: errorMsg,
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
