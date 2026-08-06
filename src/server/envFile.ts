// Backend-only helper: persist key=value pairs into a .env file
// (replace in place or append) and mirror them into process.env.

import fs from "fs";
import path from "path";

export const CONFIG_TOML_ENV_KEYS = new Map<string, string>([
  ["pexels_api_key", "PEXELS_API_KEY"],
  ["pexels_key", "PEXELS_KEY"],
  ["llm_provider", "LLM_PROVIDER"],
  ["llm_request_timeout_seconds", "LLM_REQUEST_TIMEOUT_SECONDS"],
  ["groq_api_key", "GROQ_API_KEY"],
  ["groq_base_url", "GROQ_BASE_URL"],
  ["groq_model_name", "GROQ_MODEL"],
  ["gemini_api_key", "GEMINI_API_KEY"],
  ["gemini_model_name", "GEMINI_MODEL"],
  ["gemini_model", "GEMINI_MODEL"],
  ["deepseek_api_key", "DEEPSEEK_API_KEY"],
  ["deepseek_base_url", "DEEPSEEK_BASE_URL"],
  ["deepseek_model_name", "DEEPSEEK_MODEL"],
  ["openai_api_base", "OPENAI_API_BASE"],
  ["openai_api_key", "OPENAI_API_KEY"],
  ["openai_model", "OPENAI_MODEL"],
  ["youtube_client_id", "YOUTUBE_CLIENT_ID"],
  ["youtube_client_secret", "YOUTUBE_CLIENT_SECRET"],
  ["tiktok_client_key", "TIKTOK_CLIENT_KEY"],
  ["tiktok_client_secret", "TIKTOK_CLIENT_SECRET"],
]);

export const readLlmSettings = (env: NodeJS.ProcessEnv = process.env) => {
  const fallbackValue = env.LLM_FALLBACK_PROVIDERS === undefined
    ? "gemini,deepseek"
    : env.LLM_FALLBACK_PROVIDERS;
  const timeout = Number(env.LLM_REQUEST_TIMEOUT_SECONDS || "120");

  return {
    llm_provider: env.LLM_PROVIDER || "groq",
    llm_fallback_providers: fallbackValue.split(",").map((value) => value.trim()).filter(Boolean),
    llm_request_timeout_seconds: Number.isFinite(timeout) && timeout > 0 ? timeout : 120,
    groq_api_key: env.GROQ_API_KEY || "",
    groq_model_name: env.GROQ_MODEL || "llama-3.3-70b-versatile",
    groq_base_url: env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    gemini_api_key: env.GEMINI_API_KEY || "",
    gemini_model_name: env.GEMINI_MODEL || env.GEMINI_MODEL_NAME || "gemini-3.1-flash-lite",
    deepseek_api_key: env.DEEPSEEK_API_KEY || "",
    deepseek_model_name: env.DEEPSEEK_MODEL || "deepseek-chat",
    deepseek_base_url: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  };
};

const LLM_APP_ENV_FIELDS: Record<string, string> = {
  llm_provider: "LLM_PROVIDER",
  llm_request_timeout_seconds: "LLM_REQUEST_TIMEOUT_SECONDS",
  groq_api_key: "GROQ_API_KEY",
  groq_model_name: "GROQ_MODEL",
  groq_base_url: "GROQ_BASE_URL",
  gemini_api_key: "GEMINI_API_KEY",
  gemini_model_name: "GEMINI_MODEL",
  deepseek_api_key: "DEEPSEEK_API_KEY",
  deepseek_model_name: "DEEPSEEK_MODEL",
  deepseek_base_url: "DEEPSEEK_BASE_URL",
};

export const llmEnvUpdatesFromAppPatch = (
  patch: Record<string, unknown>
): Record<string, string> => {
  const updates: Record<string, string> = {};
  for (const [field, envKey] of Object.entries(LLM_APP_ENV_FIELDS)) {
    const value = patch[field];
    if (typeof value === "string" || typeof value === "number") {
      updates[envKey] = String(value);
    }
  }
  if (Array.isArray(patch.llm_fallback_providers)) {
    updates.LLM_FALLBACK_PROVIDERS = patch.llm_fallback_providers
      .filter((value): value is string => typeof value === "string")
      .join(",");
  }
  return updates;
};

export const loadEnvFile = (
  envPath: string = path.join(process.cwd(), ".env"),
  target: NodeJS.ProcessEnv = process.env
): void => {
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && value && target[key] === undefined) {
      target[key] = value;
    }
  }
};

export const updateEnvFile = (
  updates: Record<string, string>,
  envPath: string = path.join(process.cwd(), ".env")
): void => {
  let content = "";
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, "utf-8");
  }
  const lines = content.split(/\r?\n/);
  for (const [key, val] of Object.entries(updates)) {
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith(`${key}=`)) {
        lines[i] = `${key}=${val}`;
        found = true;
        break;
      }
    }
    if (!found) {
      lines.push(`${key}=${val}`);
    }
    process.env[key] = val;
  }
  fs.writeFileSync(envPath, lines.join("\n"), { encoding: "utf-8", mode: 0o600 });
};
