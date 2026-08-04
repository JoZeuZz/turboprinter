import { afterEach, describe, expect, it, vi } from "vitest";

const generateLlmContentMock = vi.fn();
vi.mock("../../server/llm", () => ({
  generateLlmContent: (...args: unknown[]) => generateLlmContentMock(...args),
}));

import { classifyScriptMood, pickBgmForMood } from "../../server/musicMood";

afterEach(() => {
  vi.restoreAllMocks();
  generateLlmContentMock.mockReset();
});

describe("pickBgmForMood", () => {
  const files = [
    { file: "/public/musics/upbeat_synthwave.mp3", name: "Upbeat Synthwave" },
    { file: "/public/musics/calm_ambient.mp3", name: "Calm Ambient" },
  ];

  it("returns the mood-prefixed file when one exists", () => {
    expect(pickBgmForMood(files, "calm")).toMatchObject({ file: "/public/musics/calm_ambient.mp3" });
  });

  it("falls back to a random file from the list when no mood-prefixed file exists", () => {
    const picked = pickBgmForMood(files, "tense");
    expect(files).toContainEqual(picked);
  });

  it("returns null when the input list is empty", () => {
    expect(pickBgmForMood([], "neutral")).toBeNull();
  });
});

describe("classifyScriptMood", () => {
  it("returns the classified mood when the LLM responds with a valid tag", async () => {
    generateLlmContentMock.mockResolvedValue("dramatic");
    await expect(classifyScriptMood("un guion muy intenso")).resolves.toBe("dramatic");
  });

  it("returns neutral when the LLM call throws", async () => {
    generateLlmContentMock.mockRejectedValue(new Error("network down"));
    await expect(classifyScriptMood("cualquier guion")).resolves.toBe("neutral");
  });

  it("returns neutral when the LLM returns text outside MOOD_TAGS", async () => {
    generateLlmContentMock.mockResolvedValue("no lo se");
    await expect(classifyScriptMood("guion ambiguo")).resolves.toBe("neutral");
  });
});
