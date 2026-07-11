// webui-react/src/store/useTaskStore.ts
import { create } from "zustand";
import type { TaskStatus } from "../api/types";

interface TaskStoreState {
  taskId: string | null;
  status: TaskStatus | null;
  isRunning: boolean;
  error: string | null;
  setTaskId: (id: string) => void;
  updateStatus: (status: TaskStatus) => void;
  setRunning: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
}

export const useTaskStore = create<TaskStoreState>((set) => ({
  taskId: null,
  status: null,
  isRunning: false,
  error: null,
  setTaskId: (id) => set({ taskId: id }),
  updateStatus: (status) => set({ status }),
  setRunning: (v) => set({ isRunning: v }),
  setError: (msg) => set({ error: msg }),
  reset: () =>
    set({ taskId: null, status: null, isRunning: false, error: null }),
}));
