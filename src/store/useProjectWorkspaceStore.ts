// webui-react/src/store/useProjectWorkspaceStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WorkspacePanel } from "../types/workspace";

interface WorkspaceStoreState {
  panel: WorkspacePanel;
  topic: string;
  error: string | null;
  videoUrls: string[];
  setTopic: (topic: string) => void;
  setPanel: (panel: WorkspacePanel) => void;
  reset: () => void;
}

const INITIAL: Omit<WorkspaceStoreState, "setTopic" | "setPanel" | "reset"> = {
  panel: "script",
  topic: "",
  error: null,
  videoUrls: [],
};

export const useProjectWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setTopic: (topic) => set({ topic }),

      setPanel: (panel) => set({ panel }),

      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "mpt-workspace",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
