import { GoogleGenAI } from "@google/genai";

type LlmProvider = "groq" | "gemini" | "deepseek" | "lmstudio" | "openai";
type OpenAiCompatibleProvider = Exclude<LlmProvider, "gemini">;

const SUPPORTED_PROVIDERS = new Set<LlmProvider>([
  "groq",
  "gemini",
  "deepseek",
  "lmstudio",
  "openai",
]);

class ProviderHttpError extends Error {
  constructor(provider: string, readonly status: number) {
    super(`${provider} returned HTTP ${status}`);
  }
}

interface OpenAiCompatibleConfig {
  label: string;
  apiBase: string;
  apiKey: string;
  model: string;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const openAiConfigFor = (provider: OpenAiCompatibleProvider): OpenAiCompatibleConfig => {
  if (provider === "groq") {
    return {
      label: "Groq",
      apiBase: trimTrailingSlash(process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"),
      apiKey: process.env.GROQ_API_KEY || "",
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    };
  }
  if (provider === "deepseek") {
    return {
      label: "DeepSeek",
      apiBase: trimTrailingSlash(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"),
      apiKey: process.env.DEEPSEEK_API_KEY || "",
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
    };
  }
  return {
    label: provider === "lmstudio" ? "LM Studio" : "OpenAI-compatible provider",
    apiBase: trimTrailingSlash(process.env.OPENAI_API_BASE || "http://localhost:1234/v1"),
    apiKey: process.env.OPENAI_API_KEY || "lm-studio",
    model: process.env.OPENAI_MODEL || "loaded-model",
  };
};

const requestTimeoutMs = (): number => {
  const seconds = Number(process.env.LLM_REQUEST_TIMEOUT_SECONDS || "120");
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 120_000;
};

async function callOpenAiCompatible(
  provider: OpenAiCompatibleProvider,
  prompt: string,
  jsonMode = false,
  systemInstruction?: string,
): Promise<string> {
  const config = openAiConfigFor(provider);
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }

  const jsonInstruction = "\n\nCRITICAL: Return ONLY a valid JSON object. Do not include explanations or markdown fences.";
  messages.push({ role: "user", content: jsonMode ? prompt + jsonInstruction : prompt });

  const response = await fetch(`${config.apiBase}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(requestTimeoutMs()),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new ProviderHttpError(config.label, response.status);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content || "";
  return jsonMode ? text.replace(/```json/gi, "").replace(/```/g, "").trim() : text;
}

export async function callLmStudio(
  prompt: string,
  jsonMode = false,
  systemInstruction?: string,
): Promise<string> {
  return callOpenAiCompatible("lmstudio", prompt, jsonMode, systemInstruction);
}

export async function callGemini(
  prompt: string,
  jsonMode = false,
  systemInstruction?: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("No Gemini API key configured. Set GEMINI_API_KEY.");
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
  const modelName = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME || "gemini-3.1-flash-lite";
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: {
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
      ...(systemInstruction ? { systemInstruction } : {}),
    },
  });
  return response.text || "";
}

const providerChain = (): LlmProvider[] => {
  const configuredFallbacks = process.env.LLM_FALLBACK_PROVIDERS;
  const names = [
    process.env.LLM_PROVIDER || "groq",
    ...(configuredFallbacks === undefined ? "gemini,deepseek" : configuredFallbacks).split(","),
  ].map((name) => name.trim()).filter(Boolean);
  const unique = [...new Set(names)];

  for (const name of unique) {
    if (!SUPPORTED_PROVIDERS.has(name as LlmProvider)) {
      throw new Error(`Unsupported LLM provider: ${name}`);
    }
  }
  return unique as LlmProvider[];
};

const providerIsConfigured = (provider: LlmProvider): boolean => {
  if (provider === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  if (provider === "deepseek") return Boolean(process.env.DEEPSEEK_API_KEY);
  return true;
};

export const hasConfiguredLlmProvider = (): boolean =>
  providerChain().some(providerIsConfigured);

const statusFromError = (error: unknown): number | undefined => {
  if (error instanceof ProviderHttpError) return error.status;
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = Number((error as { status?: unknown }).status);
    return Number.isFinite(status) ? status : undefined;
  }
  return undefined;
};

const isRecoverable = (error: unknown): boolean => {
  const status = statusFromError(error);
  return status === undefined || status === 429 || status >= 500;
};

const providerLabel = (provider: LlmProvider): string => {
  if (provider === "gemini") return "Gemini";
  return openAiConfigFor(provider).label;
};

const sanitizedError = (provider: LlmProvider, error: unknown): Error => {
  if (error instanceof ProviderHttpError) return error;
  const status = statusFromError(error);
  return new Error(`${providerLabel(provider)} request failed${status ? ` with HTTP ${status}` : ""}`);
};

export async function generateLlmContent(
  prompt: string,
  jsonMode = false,
  systemInstruction?: string,
): Promise<string> {
  const chain = providerChain();
  const configured = chain.filter(providerIsConfigured);
  if (configured.length === 0) {
    throw new Error(`No credentials configured for LLM providers: ${chain.join(", ")}`);
  }

  for (let index = 0; index < configured.length; index++) {
    const provider = configured[index];
    try {
      return provider === "gemini"
        ? await callGemini(prompt, jsonMode, systemInstruction)
        : await callOpenAiCompatible(provider, prompt, jsonMode, systemInstruction);
    } catch (error) {
      const safeError = sanitizedError(provider, error);
      if (!isRecoverable(error) || index === configured.length - 1) {
        throw safeError;
      }
      console.warn(`[LLM] ${providerLabel(provider)} failed; trying ${providerLabel(configured[index + 1])}.`);
    }
  }

  throw new Error("No configured LLM provider completed the request.");
}

export const generateOpenAiCompatibleContent = callLmStudio;
export const generateGeminiContent = callGemini;
