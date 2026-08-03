import { apiFetch } from "./client";

export interface ScriptRequest {
  video_subject: string;
  video_language?: string;
  paragraph_number?: number;
  video_script_prompt?: string;
  custom_system_prompt?: string;
  is_multi_part?: boolean;
  parts_count?: number;
  hook_style?: string;
}

export interface TermsRequest {
  video_subject: string;
  video_script: string;
  amount?: number;
}

export interface MetadataRequest {
  video_subject: string;
  video_script: string;
}

export const llmApi = {
  generateScript: (params: ScriptRequest) =>
    apiFetch<{
      video_script: string;
      multi_part_scripts?: string[];
      title_options?: string[];
      generated_description?: string;
      generated_tags?: string;
    }>("/scripts", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  generateMetadata: (params: MetadataRequest) =>
    apiFetch<{
      title_options: string[];
      generated_description: string;
      generated_tags: string;
    }>("/generate-metadata", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  generateTerms: (params: TermsRequest) =>
    apiFetch<{ video_terms: string[] }>("/terms", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
