import { create } from "zustand";
import { workspacesApi } from "../api/workspaces";
import type { Workspace, WorkspaceUpsertRequest } from "../api/types";

interface WorkspacesStoreState {
  workspaces: Workspace[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  create: (params: WorkspaceUpsertRequest) => Promise<Workspace>;
  update: (id: string, params: WorkspaceUpsertRequest) => Promise<Workspace>;
  remove: (id: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export const useWorkspacesStore = create<WorkspacesStoreState>()((set, get) => ({
  workspaces: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const { workspaces } = await workspacesApi.list();
      set({ workspaces, loading: false });
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
    }
  },

  create: async (params) => {
    const { workspace } = await workspacesApi.create(params);
    set({ workspaces: [...get().workspaces, workspace] });
    return workspace;
  },

  update: async (id, params) => {
    const { workspace } = await workspacesApi.update(id, params);
    set({
      workspaces: get().workspaces.map((w) => (w.id === id ? workspace : w)),
    });
    return workspace;
  },

  remove: async (id) => {
    await workspacesApi.remove(id);
    set({ workspaces: get().workspaces.filter((w) => w.id !== id) });
  },
}));
