import { describe, expect, it } from "vitest";
import {
  buildFontsConf,
  escapeAssPathForFilter,
  buildAudioMixFilter,
  buildMixDurationArgs,
  duckDbToRatio,
  DEFAULT_DUCK_DB,
  DEFAULT_COMMAND_TIMEOUT_MS,
  PROBE_COMMAND_TIMEOUT_MS,
  pickBgm,
  correctPexelsCdnUrl,
} from "../../server/render";

describe("correctPexelsCdnUrl", () => {
  it("rewrites the images CDN host to the videos CDN", () => {
    expect(correctPexelsCdnUrl("https://images.pexels.com/video-files/1/a.mp4")).toBe(
      "https://videos.pexels.com/video-files/1/a.mp4"
    );
  });
  it("leaves other urls untouched", () => {
    expect(correctPexelsCdnUrl("https://videos.pexels.com/video-files/1/a.mp4")).toBe(
      "https://videos.pexels.com/video-files/1/a.mp4"
    );
  });
});

describe("buildFontsConf", () => {
  it("lists project and system font dirs plus a per-task cache dir", () => {
    const xml = buildFontsConf("/repo", "task_1");
    expect(xml).toContain("<dir>/repo/public/fonts</dir>");
    expect(xml).toContain("<dir>/repo/resource/fonts</dir>");
    expect(xml).toContain("<dir>/usr/share/fonts</dir>");
    expect(xml).toContain("<cachedir>/tmp/fonts-cache-task_1</cachedir>");
    expect(xml).toContain('<include ignore_missing="yes">/etc/fonts/fonts.conf</include>');
  });
});

describe("escapeAssPathForFilter", () => {
  it("escapes colons and single quotes for the ffmpeg subtitles filter", () => {
    expect(escapeAssPathForFilter("storage/renders/subtitles.ass")).toBe(
      "storage/renders/subtitles.ass"
    );
    expect(escapeAssPathForFilter("C:/render/it's.ass")).toBe("C\\:/render/it'\\\\''s.ass");
  });
});

describe("duckDbToRatio", () => {
  it("converts the decided 12 dB default to a sidechaincompress ratio", () => {
    expect(duckDbToRatio(12)).toBe(3.98);
  });
  it("rounds to two decimals", () => {
    expect(duckDbToRatio(6)).toBe(2);
    expect(duckDbToRatio(20)).toBe(10);
  });
});

describe("buildAudioMixFilter", () => {
  it("ducks the music under the narration by default", () => {
    expect(buildAudioMixFilter(true, true, 1.0, 0.2)).toBe(
      "[1:a]volume=1[v];[2:a]volume=0.2[m];[v]asplit=2[v1][vsc];" +
        "[m][vsc]sidechaincompress=threshold=0.02:ratio=3.98:attack=5:release=200[mduck];" +
        "[v1][mduck]amix=inputs=2:duration=first[a]"
    );
    expect(buildAudioMixFilter(true, true, 1.0, 0.2)).toBe(
      buildAudioMixFilter(true, true, 1.0, 0.2, DEFAULT_DUCK_DB)
    );
  });

  it("respects a custom duck depth", () => {
    expect(buildAudioMixFilter(true, true, 1.0, 0.2, 6)).toContain("ratio=2");
  });

  it("falls back to a flat mix when ducking is disabled", () => {
    expect(buildAudioMixFilter(true, true, 1.0, 0.2, 0)).toBe(
      "[1:a]volume=1[v];[2:a]volume=0.2[m];[v][m]amix=inputs=2:duration=first[a]"
    );
  });

  it("never duplicates an intermediate label without asplit", () => {
    // An FFmpeg filtergraph cannot consume the same intermediate output twice.
    // [v] must be split before it feeds both the sidechain key and the mix.
    const filter = buildAudioMixFilter(true, true, 1.0, 0.2);
    expect(filter).toContain("[v]asplit=2[v1][vsc]");
    expect(filter.match(/\[v\]/g)?.length).toBe(2); // one produced, one consumed by asplit
  });

  it("uses a single input filter when only narration or only music exists", () => {
    expect(buildAudioMixFilter(true, false, 0.8, 0.2)).toBe("[1:a]volume=0.8[a]");
    expect(buildAudioMixFilter(false, true, 1.0, 0.3)).toBe("[1:a]volume=0.3[a]");
  });

  it("does not duck when there is only one audio source", () => {
    expect(buildAudioMixFilter(true, false, 0.8, 0.2, 12)).not.toContain("sidechaincompress");
    expect(buildAudioMixFilter(false, true, 1.0, 0.3, 12)).not.toContain("sidechaincompress");
  });

  it("returns empty when there is no audio at all", () => {
    expect(buildAudioMixFilter(false, false, 1, 1)).toBe("");
  });

  it("emits a shell-safe single-line filtergraph", () => {
    const filter = buildAudioMixFilter(true, true, 1.0, 0.2);
    expect(filter).not.toMatch(/\s/);
    expect(filter).not.toContain('"');
  });
});

describe("pickBgm", () => {
  const bgmFiles = [
    { file: "/songs/calm.mp3", name: "Calm", tags: ["relax", "nature"] },
    { file: "/songs/epic.mp3", name: "Epic", tags: ["action", "sport"] },
  ];

  it("returns null when bgm is disabled", () => {
    expect(pickBgm({ bgmType: "none", bgmVolume: 0.2, searchSubject: "", bgmFiles })).toBeNull();
  });

  it("contextual mode picks the track with most tag matches", () => {
    const item = pickBgm({
      bgmType: "contextual",
      bgmVolume: 0.25,
      searchSubject: "video de sport y action extremo",
      bgmFiles,
    });
    expect(item).toMatchObject({ url: "/songs/epic.mp3", title: "Epic", volume: 0.25 });
  });

  it("file mode resolves a known file by name and passes unknown files through", () => {
    expect(
      pickBgm({ bgmType: "file", bgmFile: "Calm", bgmVolume: 0.2, searchSubject: "", bgmFiles })
    ).toMatchObject({ url: "/songs/calm.mp3", title: "Calm" });
    expect(
      pickBgm({ bgmType: "file", bgmFile: "/x/custom.mp3", bgmVolume: 0.2, searchSubject: "", bgmFiles })
    ).toMatchObject({ url: "/x/custom.mp3" });
  });

  it("random mode uses the injected index picker", () => {
    const item = pickBgm({
      bgmType: "random",
      bgmVolume: 0.2,
      searchSubject: "",
      bgmFiles,
      randomIndex: () => 1,
    });
    expect(item).toMatchObject({ url: "/songs/epic.mp3", title: "Epic" });
  });
});

describe("buildMixDurationArgs", () => {
  it("bounds the output to the measured narration duration", () => {
    expect(buildMixDurationArgs(true, 12.5)).toBe("-t 12.5");
  });

  it("leaves narration without a measured duration unbounded here, relying on amix=duration=first", () => {
    expect(buildMixDurationArgs(true, 0)).toBe("");
  });

  it("bounds a music-only mix with -shortest so the infinite BGM loop terminates (regression test for the hang)", () => {
    // The BGM input is opened with -stream_loop -1 (infinite). With no
    // narración to bound the output, ffmpeg would otherwise mix a finite
    // video against an infinite audio stream and write until disk fills.
    expect(buildMixDurationArgs(false, 0)).toBe("-shortest");
  });

  it("bounds the case with neither narration nor music, matching the anullsrc branch's own -shortest", () => {
    expect(buildMixDurationArgs(false, 0)).toBe("-shortest");
  });

  it("prefers a measured duration over the music-only default", () => {
    expect(buildMixDurationArgs(false, 8)).toBe("-t 8");
  });
});

describe("command timeout ceilings", () => {
  it("keeps the probe ceiling well below the default heavy-command ceiling", () => {
    expect(PROBE_COMMAND_TIMEOUT_MS).toBeLessThan(DEFAULT_COMMAND_TIMEOUT_MS);
  });

  it("are both positive finite numbers", () => {
    expect(Number.isFinite(DEFAULT_COMMAND_TIMEOUT_MS)).toBe(true);
    expect(DEFAULT_COMMAND_TIMEOUT_MS).toBeGreaterThan(0);
    expect(Number.isFinite(PROBE_COMMAND_TIMEOUT_MS)).toBe(true);
    expect(PROBE_COMMAND_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
