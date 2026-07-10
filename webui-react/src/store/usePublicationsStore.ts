import { create } from "zustand";
import { publicationsApi, type ListPublicationsFilters } from "../api/publications";
import type { DraftPublicationRequest, Publication } from "../api/types";

interface PublicationsStoreState {
  publications: Publication[];
  current: Publication | null;
  loading: boolean;
  error: string | null;
  refresh: (filters?: ListPublicationsFilters) => Promise<void>;
  load: (publicationId: string) => Promise<void>;
  createDraft: (
    projectId: string,
    params: DraftPublicationRequest
  ) => Promise<Publication>;
  publishDryRun: (publicationId: string) => Promise<Publication>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export const usePublicationsStore = create<PublicationsStoreState>()((set, get) => ({
  publications: [],
  current: null,
  loading: false,
  error: null,

  refresh: async (filters = {}) => {
    set({ loading: true, error: null });
    try {
      const { publications } = await publicationsApi.list(filters);
      set({ publications, loading: false });
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
    }
  },

  load: async (publicationId) => {
    set({ loading: true, error: null });
    try {
      const { publication } = await publicationsApi.get(publicationId);
      set({ current: publication, loading: false });
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
    }
  },

  createDraft: async (projectId, params) => {
    set({ loading: true, error: null });
    try {
      const { publication } = await publicationsApi.createDraft(projectId, params);
      set({
        current: publication,
        loading: false,
        publications: [
          publication,
          ...get().publications.filter((p) => p.id !== publication.id),
        ],
      });
      return publication;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },

  publishDryRun: async (publicationId) => {
    set({ loading: true, error: null });
    try {
      const { publication } = await publicationsApi.publish(publicationId, { dry_run: true });
      set({
        current: publication,
        loading: false,
        publications: get().publications.map((p) =>
          p.id === publication.id ? publication : p
        ),
      });
      return publication;
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
      throw error;
    }
  },
}));
