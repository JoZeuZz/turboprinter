// webui-react/src/api/workspaces.ts
import { apiFetch } from "./client";
import type { Workspace, WorkspaceUpsertRequest } from "./types";

export const workspacesApi = {
  list: () => apiFetch<{ workspaces: Workspace[] }>("/workspaces"),

  create: (params: WorkspaceUpsertRequest) =>
    apiFetch<{ workspace: Workspace }>("/workspaces", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  get: (workspaceId: string) =>
    apiFetch<{ workspace: Workspace }>(`/workspaces/${workspaceId}`),

  update: (workspaceId: string, params: WorkspaceUpsertRequest) =>
    apiFetch<{ workspace: Workspace }>(`/workspaces/${workspaceId}`, {
      method: "PUT",
      body: JSON.stringify(params),
    }),

  remove: (workspaceId: string) =>
    apiFetch<{ workspace_id: string; deleted: boolean }>(`/workspaces/${workspaceId}`, {
      method: "DELETE",
    }),
};
