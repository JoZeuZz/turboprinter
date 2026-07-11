import { apiFetch } from "./client";
import type { EditableConfig, UiConfig } from "./types";

export const configApi = {
  get: () => apiFetch<UiConfig>("/config"),
  update: (settings: Partial<EditableConfig>) =>
    apiFetch<UiConfig>("/config", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};
