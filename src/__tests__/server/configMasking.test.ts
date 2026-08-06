import { describe, it, expect } from "vitest";
import { maskSecrets, stripSentinelSecrets, SECRET_SENTINEL } from "../../server/configMasking";

interface FakeSettings {
  youtube: { api_key: string; client_id: string };
  tiktok: { client_secret: string };
  app: {
    gemini_api_key: string;
    groq_api_key: string;
    deepseek_api_key: string;
    pexels_api_keys: string[];
    pixabay_api_keys: string[];
  };
  siliconflow?: { api_key: string };
}

const buildSettings = (): FakeSettings => ({
  youtube: { api_key: "fake-key-1", client_id: "some-client-id" },
  tiktok: { client_secret: "not-a-real-secret" },
  app: {
    gemini_api_key: "fake-gemini-key",
    groq_api_key: "fake-groq-key",
    deepseek_api_key: "fake-deepseek-key",
    pexels_api_keys: ["fake-pexels-1", "fake-pexels-2"],
    pixabay_api_keys: [],
  },
});

describe("maskSecrets", () => {
  it("replaces a populated string secret with the sentinel", () => {
    const result = maskSecrets(buildSettings());
    expect(result.youtube.api_key).toBe(SECRET_SENTINEL);
    expect(result.tiktok.client_secret).toBe(SECRET_SENTINEL);
    expect(result.app.gemini_api_key).toBe(SECRET_SENTINEL);
    expect(result.app.groq_api_key).toBe(SECRET_SENTINEL);
    expect(result.app.deepseek_api_key).toBe(SECRET_SENTINEL);
  });

  it("replaces a populated array secret with [sentinel]", () => {
    const result = maskSecrets(buildSettings());
    expect(result.app.pexels_api_keys).toEqual([SECRET_SENTINEL]);
  });

  it("leaves an empty string unchanged", () => {
    const settings = buildSettings();
    settings.youtube.api_key = "";
    const result = maskSecrets(settings);
    expect(result.youtube.api_key).toBe("");
  });

  it("leaves an empty array unchanged", () => {
    const result = maskSecrets(buildSettings());
    expect(result.app.pixabay_api_keys).toEqual([]);
  });

  it("does not throw when a section is missing entirely", () => {
    const settings = buildSettings();
    delete settings.siliconflow;
    expect(() => maskSecrets(settings)).not.toThrow();
  });

  it("leaves a non-secret sibling field unchanged", () => {
    const result = maskSecrets(buildSettings());
    expect(result.youtube.client_id).toBe("some-client-id");
  });

  it("does not mutate the input object", () => {
    const settings = buildSettings();
    maskSecrets(settings);
    expect(settings.youtube.api_key).toBe("fake-key-1");
    expect(settings.tiktok.client_secret).toBe("not-a-real-secret");
    expect(settings.app.pexels_api_keys).toEqual(["fake-pexels-1", "fake-pexels-2"]);
  });
});

describe("stripSentinelSecrets", () => {
  it("removes a sentinel string value from the result", () => {
    const body = { youtube: { api_key: SECRET_SENTINEL, client_id: "x" } };
    const result = stripSentinelSecrets(body);
    expect(result.youtube).not.toHaveProperty("api_key");
    expect(result.youtube.client_id).toBe("x");
  });

  it("removes a [sentinel] array value from the result", () => {
    const body = { app: { pexels_api_keys: [SECRET_SENTINEL] } };
    const result = stripSentinelSecrets(body);
    expect(result.app).not.toHaveProperty("pexels_api_keys");
  });

  it("passes a genuine new value through unchanged", () => {
    const body = { youtube: { api_key: "brand-new-fake-key" } };
    const result = stripSentinelSecrets(body);
    expect(result.youtube.api_key).toBe("brand-new-fake-key");
  });

  it("passes a non-secret field through unchanged", () => {
    const body = { youtube: { client_id: "some-client-id" } };
    const result = stripSentinelSecrets(body);
    expect(result.youtube.client_id).toBe("some-client-id");
  });

  it("does not throw when a section is missing or undefined", () => {
    expect(() => stripSentinelSecrets({})).not.toThrow();
  });

  it("round-trips maskSecrets output to an object with no secret paths present", () => {
    const masked = maskSecrets(buildSettings());
    const stripped = stripSentinelSecrets(masked);
    expect(stripped.youtube).not.toHaveProperty("api_key");
    expect(stripped.tiktok).not.toHaveProperty("client_secret");
    expect(stripped.app).not.toHaveProperty("gemini_api_key");
    expect(stripped.app).not.toHaveProperty("groq_api_key");
    expect(stripped.app).not.toHaveProperty("deepseek_api_key");
    expect(stripped.app).not.toHaveProperty("pexels_api_keys");
  });
});
