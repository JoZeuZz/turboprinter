import { apiFetch } from "./client";

export interface ScriptRequest {
  video_subject: string;
  video_language?: string;
  paragraph_number?: number;
  video_script_prompt?: string;
  custom_system_prompt?: string;
}

export interface TermsRequest {
  video_subject: string;
  video_script: string;
  amount?: number;
}

export const llmApi = {
  generateScript: (params: ScriptRequest) =>
    apiFetch<{ video_script: string }>("/scripts", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  generateTerms: (params: TermsRequest) =>
    apiFetch<{ video_terms: string[] }>("/terms", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
