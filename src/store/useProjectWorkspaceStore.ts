// webui-react/src/store/useProjectWorkspaceStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WorkspacePanel } from "../types/workspace";

interface WorkspaceStoreState {
  panel: WorkspacePanel;
  topic: string;
  error: string | null;
  videoUrls: string[];
  activePartIndex: number;
  partVideoUrls: Record<number, string>;
  setTopic: (topic: string) => void;
  setPanel: (panel: WorkspacePanel) => void;
  setActivePartIndex: (index: number) => void;
  setPartVideoUrl: (partIndex: number, url: string) => void;
  reset: () => void;
}

const INITIAL: Omit<
  WorkspaceStoreState,
  | "setTopic"
  | "setPanel"
  | "setActivePartIndex"
  | "setPartVideoUrl"
  | "reset"
> = {
  panel: "script",
  topic: "",
  error: null,
  videoUrls: [],
  activePartIndex: 1,
  partVideoUrls: {},
};

export const useProjectWorkspaceStore = create<WorkspaceStoreState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setTopic: (topic) => set({ topic }),

      setPanel: (panel) => set({ panel }),

      setActivePartIndex: (activePartIndex) => set({ activePartIndex }),

      setPartVideoUrl: (partIndex, url) =>
        set((state) => ({
          partVideoUrls: { ...state.partVideoUrls, [partIndex]: url },
        })),

      reset: () => set({ ...INITIAL }),
    }),
    {
      name: "mpt-workspace",
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
