// webui-react/src/store/useProjectWorkspaceStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { videoApi } from "../api/video";
import { pollTask } from "../api/polling";
import type { TaskStatus, VideoParams } from "../api/types";
import type { WorkspacePanel } from "../types/workspace";

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
          set({ taskId: task_id });
          await pollTask(task_id, (status: TaskStatus) => {
            set({ taskStatus: status });
          });
          // pollTask resolves on TASK_STATE_COMPLETE (throws on TASK_STATE_FAILED)
          // After successful completion, retrieve final taskStatus to get video URLs
          set((state) => {
            const status = state.taskStatus;
            const urls = [
              ...(status?.combined_videos ?? []),
              ...(status?.videos ?? []),
            ];
            return { panel: "done", videoUrls: [...new Set(urls)] };
          });
        } catch (e) {
          set({
            panel: "config",
            error: e instanceof Error ? e.message : "Generation failed",
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
