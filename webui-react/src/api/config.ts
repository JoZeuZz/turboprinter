import { apiFetch } from "./client";
import type { UiConfig } from "./types";

export const configApi = {
  get: () => apiFetch<UiConfig>("/config"),
};
