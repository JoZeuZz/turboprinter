import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateLlmContent } from "../../server/llm";

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = {
      generateContent: async () => ({ text: "gemini says hi" }),
    };
  },
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

describe("generateLlmContent (openai-compatible provider)", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "lmstudio";
    process.env.OPENAI_API_BASE = "http://localhost:1234/v1";
    delete process.env.OPENAI_MODEL;
  });

  it("posts messages to the chat/completions endpoint and returns the content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "local says hi" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await generateLlmContent("hola");

    expect(out).toBe("local says hi");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:1234/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.messages).toEqual([{ role: "user", content: "hola" }]);
    expect(body.response_format).toBeUndefined();
  });

  it("in jsonMode on a non-official endpoint appends the JSON-only instruction instead of response_format", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '```json\n{"a":1}\n```' } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await generateLlmContent("hola", true);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.response_format).toBeUndefined();
    expect(body.messages[0].content).toContain("Return ONLY a valid JSON object");
    expect(out).toBe('{"a":1}');
  });

  it("passes a system instruction as the system message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await generateLlmContent("hola", false, "eres conciso");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[0]).toEqual({ role: "system", content: "eres conciso" });
  });

  it("throws with status detail when the endpoint errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => "bad request" })
    );

    await expect(generateLlmContent("hola")).rejects.toThrow(/400/);
  });
});

describe("generateLlmContent (gemini provider)", () => {
  it("throws a clear error when no API key is configured", async () => {
    process.env.LLM_PROVIDER = "gemini";
    delete process.env.GEMINI_API_KEY;

    await expect(generateLlmContent("hola")).rejects.toThrow(/GEMINI_API_KEY/);
  });

  it("returns the SDK response text when a key is present", async () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-key";

    await expect(generateLlmContent("hola")).resolves.toBe("gemini says hi");
  });
});
