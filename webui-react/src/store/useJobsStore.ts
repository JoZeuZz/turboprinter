import { create } from "zustand";
import { jobsApi, type ListJobsFilters } from "../api/jobs";
import type { Job, RunFullPipelineRequest, RunFullPipelineResponse } from "../api/types";

interface JobsStoreState {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  refresh: (filters?: ListJobsFilters) => Promise<void>;
  cancel: (jobId: string) => Promise<void>;
  runFullPipeline: (
    workspaceId: string,
    params: RunFullPipelineRequest
  ) => Promise<RunFullPipelineResponse>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export const useJobsStore = create<JobsStoreState>()((set, get) => ({
  jobs: [],
  loading: false,
  error: null,

  refresh: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const { jobs } = await jobsApi.list(filters);
      set({ jobs, loading: false });
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
    }
  },

  cancel: async (jobId) => {
    const { job } = await jobsApi.cancel(jobId);
    set({ jobs: get().jobs.map((j) => (j.id === jobId ? job : j)) });
  },

  runFullPipeline: async (workspaceId, params) => {
    return jobsApi.runFullPipeline(workspaceId, params);
  },
}));
