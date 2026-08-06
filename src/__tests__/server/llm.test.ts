import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateLlmContent } from "../../server/llm";
import * as llmModule from "../../server/llm";

const geminiGenerateContent = vi.hoisted(() => vi.fn());

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiGenerateContent };
  },
}));

const ORIGINAL_ENV = { ...process.env };
const LLM_ENV_KEYS = [
  "LLM_PROVIDER",
  "LLM_FALLBACK_PROVIDERS",
  "LLM_REQUEST_TIMEOUT_SECONDS",
  "GROQ_API_KEY",
  "GROQ_BASE_URL",
  "GROQ_MODEL",
  "GEMINI_API_KEY",
  "GEMINI_MODEL",
  "GEMINI_MODEL_NAME",
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "OPENAI_API_BASE",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
] as const;

beforeEach(() => {
  vi.unstubAllGlobals();
  geminiGenerateContent.mockReset();
  geminiGenerateContent.mockResolvedValue({ text: "gemini says hi" });
  for (const key of LLM_ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

const successfulResponse = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

describe("generateLlmContent provider selection", () => {
  it("uses Groq first with the default provider chain", async () => {
    process.env.GROQ_API_KEY = "fake-groq";
    process.env.GROQ_MODEL = "groq-model";
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse("groq says hi"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).resolves.toBe("groq says hi");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer fake-groq");
    expect(JSON.parse(init.body).model).toBe("groq-model");
  });

  it("skips unconfigured Groq and uses Gemini", async () => {
    process.env.GEMINI_API_KEY = "fake-gemini";

    await expect(generateLlmContent("hola")).resolves.toBe("gemini says hi");
    expect(geminiGenerateContent).toHaveBeenCalledOnce();
  });

  it("uses DeepSeek-specific configuration when selected", async () => {
    process.env.LLM_PROVIDER = "deepseek";
    process.env.LLM_FALLBACK_PROVIDERS = "";
    process.env.DEEPSEEK_API_KEY = "fake-deepseek";
    process.env.DEEPSEEK_BASE_URL = "https://deepseek.invalid/v1/";
    process.env.DEEPSEEK_MODEL = "deepseek-model";
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse("deepseek says hi"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).resolves.toBe("deepseek says hi");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://deepseek.invalid/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer fake-deepseek");
    expect(JSON.parse(init.body).model).toBe("deepseek-model");
  });

  it("rejects an unknown provider before making a request", async () => {
    process.env.LLM_PROVIDER = "unknown";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).rejects.toThrow("Unsupported LLM provider: unknown");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports configured provider names when none has credentials", async () => {
    await expect(generateLlmContent("hola")).rejects.toThrow(
      "No credentials configured for LLM providers: groq, gemini, deepseek",
    );
  });
});

describe("generateLlmContent fallback policy", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "fake-groq";
    process.env.DEEPSEEK_API_KEY = "fake-deepseek";
    process.env.LLM_FALLBACK_PROVIDERS = "deepseek";
  });

  it.each([429, 500, 503])("falls back from Groq on HTTP %s", async (status) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status })
      .mockResolvedValueOnce(successfulResponse("fallback"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).resolves.toBe("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not fall back on a non-retryable HTTP 400", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).rejects.toThrow("Groq returned HTTP 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back after a network error", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(successfulResponse("fallback"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).resolves.toBe("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back after a timeout", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new DOMException("Timed out", "TimeoutError"))
      .mockResolvedValueOnce(successfulResponse("fallback"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).resolves.toBe("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("deduplicates fallback providers", async () => {
    process.env.LLM_FALLBACK_PROVIDERS = "groq,deepseek,deepseek";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(successfulResponse("fallback"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).resolves.toBe("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("generateLlmContent request shape", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "lmstudio";
    process.env.LLM_FALLBACK_PROVIDERS = "";
    process.env.OPENAI_API_BASE = "http://localhost:1234/v1";
  });

  it("keeps explicit LM Studio support", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse("local says hi"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola")).resolves.toBe("local says hi");
    expect(fetchMock.mock.calls[0][0]).toBe("http://localhost:1234/v1/chat/completions");
  });

  it("adds JSON-only instructions and strips markdown fences", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse('```json\n{"a":1}\n```'));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateLlmContent("hola", true)).resolves.toBe('{"a":1}');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Return ONLY a valid JSON object");
  });

  it("passes a system instruction as the first message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(successfulResponse("ok"));
    vi.stubGlobal("fetch", fetchMock);

    await generateLlmContent("hola", false, "eres conciso");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "eres conciso" });
  });
});

describe("generateLlmContent Gemini provider", () => {
  it("uses the configured Gemini model", async () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.LLM_FALLBACK_PROVIDERS = "";
    process.env.GEMINI_API_KEY = "fake-gemini";
    process.env.GEMINI_MODEL = "gemini-model";

    await expect(generateLlmContent("hola")).resolves.toBe("gemini says hi");
    expect(geminiGenerateContent).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-model" }));
  });
});

describe("hasConfiguredLlmProvider", () => {
  it("recognizes credentials in the configured provider chain", () => {
    const helper = (llmModule as typeof llmModule & {
      hasConfiguredLlmProvider?: () => boolean;
    }).hasConfiguredLlmProvider;
    expect(helper).toBeTypeOf("function");

    expect(helper?.()).toBe(false);
    process.env.DEEPSEEK_API_KEY = "fake-deepseek";
    expect(helper?.()).toBe(true);
  });
});
