import { apiFetch } from "./client";
import type {
  Job,
  JobCreateRequest,
  RunFullPipelineRequest,
  RunFullPipelineResponse,
} from "./types";

export interface ListJobsFilters {
  status?: string;
  type?: string;
  workspace_id?: string;
  project_id?: string;
}

function toQueryString(filters: ListJobsFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const jobsApi = {
  list: (filters: ListJobsFilters = {}) =>
    apiFetch<{ jobs: Job[] }>(`/jobs${toQueryString(filters)}`),

  get: (jobId: string) => apiFetch<{ job: Job }>(`/jobs/${jobId}`),

  create: (params: JobCreateRequest) =>
    apiFetch<{ job: Job }>("/jobs", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  cancel: (jobId: string) =>
    apiFetch<{ job: Job }>(`/jobs/${jobId}/cancel`, { method: "POST" }),

  runFullPipeline: (workspaceId: string, params: RunFullPipelineRequest) =>
    apiFetch<RunFullPipelineResponse>(
      `/workspaces/${workspaceId}/run-full-pipeline`,
      { method: "POST", body: JSON.stringify(params) }
    ),
};
