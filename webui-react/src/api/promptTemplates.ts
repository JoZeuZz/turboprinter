// webui-react/src/api/promptTemplates.ts
import { apiFetch } from "./client";
import type {
  PromptTemplate,
  PromptTemplateCreateRequest,
  PromptTemplateUpdateRequest,
  PromptVersion,
  PromptVersionCreateRequest,
} from "./types";

export const promptTemplatesApi = {
  list: () => apiFetch<{ templates: PromptTemplate[] }>("/prompt-templates"),

  create: (params: PromptTemplateCreateRequest) =>
    apiFetch<{ template: PromptTemplate }>("/prompt-templates", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  get: (templateId: string) =>
    apiFetch<{ template: PromptTemplate }>(`/prompt-templates/${templateId}`),

  update: (templateId: string, params: PromptTemplateUpdateRequest) =>
    apiFetch<{ template: PromptTemplate }>(`/prompt-templates/${templateId}`, {
      method: "PUT",
      body: JSON.stringify(params),
    }),

  addVersion: (templateId: string, params: PromptVersionCreateRequest) =>
    apiFetch<{ version: PromptVersion }>(`/prompt-templates/${templateId}/versions`, {
      method: "POST",
      body: JSON.stringify(params),
    }),

  listVersions: (templateId: string) =>
    apiFetch<{ versions: PromptVersion[] }>(`/prompt-templates/${templateId}/versions`),

  activateVersion: (templateId: string, versionId: string) =>
    apiFetch<{ template: PromptTemplate }>(`/prompt-templates/${templateId}/activate-version`, {
      method: "POST",
      body: JSON.stringify({ version_id: versionId }),
    }),
};
