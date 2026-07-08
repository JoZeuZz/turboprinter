import { create } from "zustand";
import { promptTemplatesApi } from "../api/promptTemplates";
import type {
  PromptTemplate,
  PromptTemplateCreateRequest,
  PromptTemplateUpdateRequest,
  PromptVersion,
  PromptVersionCreateRequest,
} from "../api/types";

interface PromptTemplatesStoreState {
  templates: PromptTemplate[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  create: (params: PromptTemplateCreateRequest) => Promise<PromptTemplate>;
  update: (id: string, params: PromptTemplateUpdateRequest) => Promise<PromptTemplate>;
  addVersion: (templateId: string, params: PromptVersionCreateRequest) => Promise<PromptVersion>;
  listVersions: (templateId: string) => Promise<PromptVersion[]>;
  activateVersion: (templateId: string, versionId: string) => Promise<PromptTemplate>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export const usePromptTemplatesStore = create<PromptTemplatesStoreState>()((set, get) => ({
  templates: [],
  loading: false,
  error: null,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const { templates } = await promptTemplatesApi.list();
      set({ templates, loading: false });
    } catch (error) {
      set({ error: errorMessage(error), loading: false });
    }
  },

  create: async (params) => {
    const { template } = await promptTemplatesApi.create(params);
    set({ templates: [...get().templates, template] });
    return template;
  },

  update: async (id, params) => {
    const { template } = await promptTemplatesApi.update(id, params);
    set({
      templates: get().templates.map((t) => (t.id === id ? template : t)),
    });
    return template;
  },

  addVersion: async (templateId, params) => {
    const { version } = await promptTemplatesApi.addVersion(templateId, params);
    return version;
  },

  listVersions: async (templateId) => {
    const { versions } = await promptTemplatesApi.listVersions(templateId);
    return versions;
  },

  activateVersion: async (templateId, versionId) => {
    const { template } = await promptTemplatesApi.activateVersion(templateId, versionId);
    set({
      templates: get().templates.map((t) => (t.id === templateId ? template : t)),
    });
    return template;
  },
}));
