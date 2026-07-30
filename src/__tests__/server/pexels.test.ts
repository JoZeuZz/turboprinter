import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPexelsVideos, pickUniqueClip, clipIdOf } from "../../server/pexels";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchPexelsVideos", () => {
  const pexelsResponse = {
    videos: [
      {
        id: 42,
        width: 1080,
        height: 1920,
        duration: 12,
        image: "https://img/42.jpg",
        user: { name: "Ana" },
        video_files: [
          { quality: "uhd", link: "https://v/42-uhd.mp4" },
          { quality: "hd", link: "https://v/42-hd.mp4" },
        ],
      },
    ],
  };

  it("queries the Pexels API with the key and maps results to clips", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => pexelsResponse });
    vi.stubGlobal("fetch", fetchMock);

    const clips = await searchPexelsVideos("beach", "key-123", "portrait");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("query=beach");
    expect(url).toContain("orientation=portrait");
    expect(init.headers.Authorization).toBe("key-123");

    expect(clips).toHaveLength(1);
    expect(clips[0]).toMatchObject({
      id: "pexels_42",
      provider: "pexels",
      source_url: "https://v/42-hd.mp4", // prefers hd/sd over other qualities
      duration_sec: 12,
      query: "beach",
      title: "Video by Ana",
    });
  });

  it("returns an empty list on API errors instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(searchPexelsVideos("beach", "key")).resolves.toEqual([]);
  });
});

describe("clipIdOf", () => {
  it("prefers id, then source_url, then download_url", () => {
    expect(clipIdOf({ id: "a", source_url: "b" })).toBe("a");
    expect(clipIdOf({ source_url: "b" })).toBe("b");
    expect(clipIdOf({ download_url: "c" })).toBe("c");
    expect(clipIdOf({})).toBeNull();
  });
});

describe("pickUniqueClip", () => {
  it("picks the first clip not used yet and marks it used", () => {
    const used = new Set<string>(["a"]);
    const clips = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const picked = pickUniqueClip(clips, used);
    expect(picked).toEqual({ id: "b" });
    expect(used.has("b")).toBe(true);
  });

  it("falls back to the first clip when every candidate is already used", () => {
    const used = new Set<string>(["a", "b"]);
    const picked = pickUniqueClip([{ id: "a" }, { id: "b" }], used);
    expect(picked).toEqual({ id: "a" });
  });

  it("returns undefined for an empty candidate list", () => {
    expect(pickUniqueClip([], new Set())).toBeUndefined();
  });
});
