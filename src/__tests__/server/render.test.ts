import { describe, expect, it } from "vitest";
import {
  buildFontsConf,
  escapeAssPathForFilter,
  buildAudioMixFilter,
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

describe("buildAudioMixFilter", () => {
  it("mixes narration and music with independent volumes", () => {
    expect(buildAudioMixFilter(true, true, 1.0, 0.2)).toBe(
      "[1:a]volume=1[v];[2:a]volume=0.2[m];[v][m]amix=inputs=2:duration=first[a]"
    );
  });
  it("uses a single input filter when only narration or only music exists", () => {
    expect(buildAudioMixFilter(true, false, 0.8, 0.2)).toBe("[1:a]volume=0.8[a]");
    expect(buildAudioMixFilter(false, true, 1.0, 0.3)).toBe("[1:a]volume=0.3[a]");
  });
  it("returns empty when there is no audio at all", () => {
    expect(buildAudioMixFilter(false, false, 1, 1)).toBe("");
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
