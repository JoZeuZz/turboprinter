// webui-react/src/api/projects.ts
import { ApiError, apiFetch } from "./client";
import type {
  CreateFromTopicRequest,
  CreateFromScriptRequest,
  CreateFromRedditRequest,
  CreateProjectResponse,
  GetProjectResponse,
  PlanRequest,
  PlanProjectResponse,
  MediaSearchRequest,
  MediaSearchResponse,
  TimelineBuildRequest,
  TimelineBuildResponse,
  TimelineCommandsRequest,
  TimelineCommandsResponse,
  TimelineValidateResponse,
  MusicSelectRequest,
  MusicSelectResponse,
  MusicGetResponse,
  TimelineProject,
  ReplaceTimelineResponse,
  RenderRequest,
  RenderStartResponse,
  RenderStatusResponse,
  ListAssetsResponse,
} from "./types";

const API_BASE = "/api/v1";

function encodeAssetPath(assetId: string) {
  return assetId.split("/").map(encodeURIComponent).join("/");
}

async function fetchAsset(projectId: string, assetId: string): Promise<Blob> {
  const response = await fetch(
    `${API_BASE}/projects/${encodeURIComponent(projectId)}/assets/${encodeAssetPath(assetId)}`
  );
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new ApiError(json.status ?? response.status, json.message ?? "Request failed");
  }
  return response.blob();
}

export const projectsApi = {
  createFromTopic: (params: CreateFromTopicRequest) =>
    apiFetch<CreateProjectResponse>("/projects/from-topic", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  createFromScript: (params: CreateFromScriptRequest) =>
    apiFetch<CreateProjectResponse>("/projects/from-script", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  createFromReddit: (params: CreateFromRedditRequest) =>
    apiFetch<CreateProjectResponse>("/projects/from-reddit", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getProject: (projectId: string) =>
    apiFetch<GetProjectResponse>(`/projects/${projectId}`),

  planProject: (projectId: string, params: PlanRequest = {}) =>
    apiFetch<PlanProjectResponse>(`/projects/${projectId}/plan`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  mediaSearch: (projectId: string, params: MediaSearchRequest = {}) =>
    apiFetch<MediaSearchResponse>(`/projects/${projectId}/media/search`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  buildTimeline: (projectId: string, params: TimelineBuildRequest = {}) =>
    apiFetch<TimelineBuildResponse>(`/projects/${projectId}/timeline/build`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  applyTimelineCommands: (
    projectId: string,
    params: TimelineCommandsRequest,
    validate = false
  ) =>
    apiFetch<TimelineCommandsResponse>(
      `/projects/${projectId}/timeline/commands${validate ? "?validate=true" : ""}`,
      {
        method: "POST",
        body: JSON.stringify(params),
      }
    ),

  validateTimeline: (projectId: string) =>
    apiFetch<TimelineValidateResponse>(
      `/projects/${projectId}/timeline/validate`,
      { method: "POST" }
    ),

  selectMusic: (projectId: string, params: MusicSelectRequest = {}) =>
    apiFetch<MusicSelectResponse>(`/projects/${projectId}/music/select`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getMusic: (projectId: string) =>
    apiFetch<MusicGetResponse>(`/projects/${projectId}/music`),

  replaceTimeline: (projectId: string, project: TimelineProject) =>
    apiFetch<ReplaceTimelineResponse>(`/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(project),
    }),

  startRender: (projectId: string, params: RenderRequest = {}) =>
    apiFetch<RenderStartResponse>(`/projects/${projectId}/render`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getRenderStatus: (projectId: string) =>
    apiFetch<RenderStatusResponse>(`/projects/${projectId}/render`),

  listAssets: (projectId: string) =>
    apiFetch<ListAssetsResponse>(`/projects/${projectId}/assets`),

  getAsset: (projectId: string, assetId: string) => fetchAsset(projectId, assetId),
};
