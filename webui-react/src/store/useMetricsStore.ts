import { create } from "zustand";
import { metricsApi } from "../api/metrics";
import type { ManualMetricsRequest, MetricsSnapshot, WorkspaceMetricsSummary } from "../api/types";

interface MetricsStoreState {
  byPublication: Record<string, MetricsSnapshot[]>;
  workspaceSummaries: Record<string, WorkspaceMetricsSummary>;
  loading: boolean;
  error: string | null;
  loadPublication: (publicationId: string) => Promise<void>;
  saveManual: (publicationId: string, params: ManualMetricsRequest) => Promise<MetricsSnapshot>;
  loadWorkspaceSummary: (workspaceId: string) => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export const useMetricsStore = create<MetricsStoreState>()((set, get) => ({
  byPublication: {},
  workspaceSummaries: {},
  loading: false,
  error: null,

  loadPublication: async (publicationId) => {
    set({ loading: true, error: null });
    try {
      const { metrics } = await metricsApi.listForPublication(publicationId);
      set({ byPublication: { ...get().byPublication, [publicationId]: metrics }, loading: false });
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
    }
  },

  saveManual: async (publicationId, params) => {
    set({ loading: true, error: null });
    try {
      const { metrics_snapshot } = await metricsApi.saveForPublication(publicationId, params);
      const existing = get().byPublication[publicationId] ?? [];
      const next = [metrics_snapshot, ...existing.filter((s) => s.id !== metrics_snapshot.id)];
      set({ byPublication: { ...get().byPublication, [publicationId]: next }, loading: false });
      return metrics_snapshot;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },

  loadWorkspaceSummary: async (workspaceId) => {
    set({ loading: true, error: null });
    try {
      const summary = await metricsApi.workspaceSummary(workspaceId);
      set({ workspaceSummaries: { ...get().workspaceSummaries, [workspaceId]: summary }, loading: false });
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
    }
  },
}));
