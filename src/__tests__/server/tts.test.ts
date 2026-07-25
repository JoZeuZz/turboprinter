import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanVoiceName,
  getEdgeVoiceAndLang,
  generateSecMsGec,
  buildSsml,
  parseEdgeAudioFrame,
} from "../../server/tts";

describe("cleanVoiceName", () => {
  it("strips provider prefixes and gender suffixes", () => {
    expect(cleanVoiceName("azure:es-ES-AlvaroNeural-Male")).toBe("es-ES-AlvaroNeural");
    expect(cleanVoiceName("es-ES-ElviraNeural-Female")).toBe("es-ES-ElviraNeural");
    expect(cleanVoiceName("siliconflow:x:alex-Male")).toBe("alex");
  });
});

describe("getEdgeVoiceAndLang", () => {
  it("keeps a full locale voice as-is and derives its lang", () => {
    expect(getEdgeVoiceAndLang("es-ES-AlvaroNeural-Male")).toEqual({
      voice: "es-ES-AlvaroNeural",
      lang: "es-ES",
    });
  });
  it("maps a bare male English-name to the Guy neural voice", () => {
    expect(getEdgeVoiceAndLang("guy")).toEqual({
      voice: "en-US-GuyNeural",
      lang: "en-US",
    });
  });
  it("maps a bare Spanish female name to Elvira", () => {
    expect(getEdgeVoiceAndLang("elvira")).toEqual({
      voice: "es-ES-ElviraNeural",
      lang: "es-ES",
    });
  });
});

describe("generateSecMsGec", () => {
  afterEach(() => vi.useRealTimers());

  it("returns 64 uppercase hex chars", () => {
    expect(generateSecMsGec()).toMatch(/^[0-9A-F]{64}$/);
  });

  it("is stable within a 300s clock window and changes across windows", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-24T10:00:10Z"));
    const first = generateSecMsGec();
    vi.setSystemTime(new Date("2026-07-24T10:04:50Z"));
    const sameWindow = generateSecMsGec();
    vi.setSystemTime(new Date("2026-07-24T10:05:10Z"));
    const nextWindow = generateSecMsGec();
    expect(sameWindow).toBe(first);
    expect(nextWindow).not.toBe(first);
  });
});

describe("buildSsml", () => {
  it("escapes XML entities in the text", () => {
    const ssml = buildSsml("a & b <c>", "es-ES-AlvaroNeural", "es-ES", 1.0, 1.0);
    expect(ssml).toContain("a &amp; b &lt;c&gt;");
  });
  it("expresses rate and volume as signed percentages", () => {
    const ssml = buildSsml("hola", "es-ES-AlvaroNeural", "es-ES", 1.2, 0.8);
    expect(ssml).toContain("rate='+20%'");
    expect(ssml).toContain("volume='-20%'");
  });
  it("embeds voice and language", () => {
    const ssml = buildSsml("hola", "es-ES-ElviraNeural", "es-ES", 1, 1);
    expect(ssml).toContain("xml:lang='es-ES'");
    expect(ssml).toContain("<voice name='es-ES-ElviraNeural'>");
  });
});

describe("parseEdgeAudioFrame", () => {
  const frame = (header: string, payload: Buffer) => {
    const headerBuf = Buffer.from(header, "utf8");
    const len = Buffer.alloc(2);
    len.writeUInt16BE(headerBuf.length, 0);
    return Buffer.concat([len, headerBuf, payload]);
  };

  it("extracts the payload of an audio frame", () => {
    const payload = Buffer.from([1, 2, 3]);
    const parsed = parseEdgeAudioFrame(frame("Path: audio\r\n", payload));
    expect(parsed).toEqual(payload);
  });

  it("returns null for non-audio frames and truncated buffers", () => {
    expect(parseEdgeAudioFrame(frame("Path: turn.start\r\n", Buffer.from([9])))).toBeNull();
    expect(parseEdgeAudioFrame(Buffer.from([0]))).toBeNull();
  });
});
