// webui-react/src/store/useConfigStore.ts
import { create } from "zustand";
import type { UiConfig } from "../api/types";

interface ConfigStoreState {
  config: UiConfig | null;
  setConfig: (cfg: UiConfig) => void;
}

export const useConfigStore = create<ConfigStoreState>((set) => ({
  config: null,
  setConfig: (cfg) => set({ config: cfg }),
}));
