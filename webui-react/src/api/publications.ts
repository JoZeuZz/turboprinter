import { apiFetch } from "./client";
import type {
  DraftPublicationRequest,
  Publication,
  PublishPublicationRequest,
} from "./types";

export interface ListPublicationsFilters {
  project_id?: string;
  workspace_id?: string;
  platform?: string;
  status?: string;
}

function toQueryString(filters: ListPublicationsFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const publicationsApi = {
  list: (filters: ListPublicationsFilters = {}) =>
    apiFetch<{ publications: Publication[] }>(`/publications${toQueryString(filters)}`),

  get: (publicationId: string) =>
    apiFetch<{ publication: Publication }>(`/publications/${publicationId}`),

  createDraft: (projectId: string, params: DraftPublicationRequest) =>
    apiFetch<{ publication: Publication }>(
      `/projects/${projectId}/publication/draft`,
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    ),

  publish: (publicationId: string, params: PublishPublicationRequest) =>
    apiFetch<{ publication: Publication }>(`/publications/${publicationId}/publish`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
