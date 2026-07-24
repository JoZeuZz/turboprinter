import { apiFetch } from "./client";
import type { ManualMetricsRequest, MetricsSnapshot, WorkspaceMetricsSummary } from "./types";

export const metricsApi = {
  listForPublication: (publicationId: string) =>
    apiFetch<{ publication_id: string; metrics: MetricsSnapshot[] }>(
      `/publications/${publicationId}/metrics`
    ),

  saveForPublication: (publicationId: string, params: ManualMetricsRequest) =>
    apiFetch<{ metrics_snapshot: MetricsSnapshot }>(`/publications/${publicationId}/metrics`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  workspaceSummary: (workspaceId: string) =>
    apiFetch<WorkspaceMetricsSummary>(`/workspaces/${workspaceId}/metrics/summary`),
};
