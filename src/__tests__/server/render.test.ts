import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";
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
  downloadFile,
  createRenderer,
} from "../../server/render";

// child_process is mocked at two levels: `exec` (used by executeCommand for
// ffmpeg/ffprobe) is faked to auto-succeed so runRealRender's pipeline runs
// fast and deterministically in tests without invoking real ffmpeg/ffprobe
// or the network; `execFile` (used by downloadFile's curl fallback, see the
// shell-injection regression test below) stays a plain vi.fn() spy so
// individual tests can assert on its call arguments and control its
// behavior per-test.
vi.mock("child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("child_process")>();
  const execFileMock = vi.fn();
  const fakeExec = (_cmd: string, optsOrCb: any, cb?: any) => {
    const callback = typeof optsOrCb === "function" ? optsOrCb : cb;
    if (callback) callback(null, "", "");
    return {} as any;
  };
  return {
    ...actual,
    exec: fakeExec,
    execFile: execFileMock,
    default: { ...actual, exec: fakeExec, execFile: execFileMock },
  };
});

describe("runRealRender: local media path containment (traversal rejection)", () => {
  let tmpLocalVideosDir: string;
  let projectFolderRoot: string;
  const cwd = process.cwd();
  let existsSyncCalls: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let existsSyncSpy: any;
  let fetchStub: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tmpLocalVideosDir = fs.mkdtempSync(path.join(os.tmpdir(), "render-test-localvideos-"));
    fs.writeFileSync(path.join(tmpLocalVideosDir, "safe.mp4"), "fake-video-bytes");

    projectFolderRoot = path.join(cwd, "storage", "renders", "test_theme_003");

    existsSyncCalls = [];
    const realExistsSync = fs.existsSync;
    existsSyncSpy = vi.spyOn(fs, "existsSync").mockImplementation((p: any) => {
      existsSyncCalls.push(String(p));
      return realExistsSync(p);
    });

    fetchStub = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    }));
    vi.stubGlobal("fetch", fetchStub);
  });

  afterEach(() => {
    existsSyncSpy.mockRestore();
    vi.unstubAllGlobals();
    fs.rmSync(tmpLocalVideosDir, { recursive: true, force: true });
    fs.rmSync(projectFolderRoot, { recursive: true, force: true });
  });

  it("never calls fs.existsSync with a path escaped outside process.cwd() for a malicious clip source_url, narration_audio_path, or BGM url", async () => {
    // One "../" is enough to land outside cwd regardless of how deep the
    // repo checkout lives, and none of these three markers contain the
    // "/storage/local_videos/" or "/local_videos/" substrings the video-clip
    // site rewrites away before it ever computes a path.
    const videoEscape = "../evil-video-marker.mp4";
    const narrationEscape = "../evil-narration-marker.mp3";
    const bgmEscape = "../evil-bgm-marker.mp3";

    // What the pre-fix code (plain path.join(process.cwd(), cleanLocalPath))
    // would have produced and handed to fs.existsSync — none of these three
    // strings should ever appear as an existsSync argument once the fix
    // (resolveWithinDir) is in place.
    const oldVulnerableVideoPath = path.join(cwd, videoEscape);
    const oldVulnerableNarrationPath = path.join(cwd, narrationEscape);
    const oldVulnerableBgmPath = path.join(cwd, bgmEscape);

    const projects = new Map<string, any>();
    const projectId = "proj_003";
    projects.set(projectId, {
      project_id: projectId,
      project_folder_name: "test_theme_003/test_project_003",
      params: {},
      tracks: [
        {
          type: "video",
          items: [
            { id: "clip1", source_url: videoEscape, duration_sec: 5, trim_start_sec: 0 },
          ],
        },
      ],
      narration_audio_path: narrationEscape,
      selected_music: [
        { id: "bgm1", provider: "local", url: bgmEscape, title: "Evil", duration_sec: 10, volume: 0.2 },
      ],
    });

    const loggedMessages: string[] = [];
    const tasks = new Map<string, any>();
    const renderer = createRenderer({
      projects,
      tasks,
      logTask: (_taskId, _level, _category, message) => {
        loggedMessages.push(message);
      },
      localVideosDir: tmpLocalVideosDir,
      bgmFiles: [],
      sanitizeFolderName: (name: string) => name,
      getFormattedDateTime: () => "20260101_000000",
    });

    await renderer.runRealRender(projectId, "task_003");

    expect(existsSyncCalls).not.toContain(oldVulnerableVideoPath);
    expect(existsSyncCalls).not.toContain(oldVulnerableNarrationPath);
    expect(existsSyncCalls).not.toContain(oldVulnerableBgmPath);

    // Positive control: the video-clip site's safety-net fallback should
    // still have found and used the legitimate file in localVideosDir,
    // proving the containment check doesn't just silently drop every clip
    // rather than actually protecting against traversal.
    expect(loggedMessages.some((m) => m.includes("safe.mp4"))).toBe(true);
  }, 15000);
});

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
        "[v1]apad[v1pad];[vsc]apad[vscpad];" +
        "[m][vscpad]sidechaincompress=threshold=0.02:ratio=3.98:attack=5:release=200[mduck];" +
        "[v1pad][mduck]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]"
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
      "[1:a]volume=1[v];[2:a]volume=0.2[m];[v]apad[vpad];[vpad][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]"
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

describe("downloadFile", () => {
  const execFileSpy = vi.mocked(execFile);

  beforeEach(() => {
    execFileSpy.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rejects non-http(s) URLs before attempting any network or subprocess call", async () => {
    await expect(downloadFile("file:///etc/passwd", "/tmp/render-test-noscheme.mp4")).rejects.toThrow(
      /non-http/i
    );
    expect(execFileSpy).not.toHaveBeenCalled();
  });

  it("passes the curl fallback URL/destPath as separate execFile argv elements, never through a shell (regression test for shell injection)", async () => {
    // A value containing a double-quote followed by shell syntax. Under the old
    // `exec()`-based implementation this would break out of the quoted curl
    // command and execute arbitrary shell commands. With execFile it must reach
    // curl as a single, inert argv element.
    const maliciousUrl = 'https://example.com/a" ; touch /tmp/pwned ; echo "';
    const destPath = "/tmp/render-test-dest.mp4";

    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    const existsSyncSpy = vi.spyOn(fs, "existsSync");
    existsSyncSpy.mockReturnValueOnce(false); // pre-check: no pre-existing file
    existsSyncSpy.mockReturnValueOnce(true); // post-curl check: curl "wrote" the file
    vi.spyOn(fs, "statSync").mockReturnValue({ size: 123 } as fs.Stats);

    execFileSpy.mockImplementation(((_file: string, _args: string[], cb: any) => {
      cb(null, "", "");
      return {} as any;
    }) as any);

    const promise = downloadFile(maliciousUrl, destPath);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(destPath);
    expect(execFileSpy).toHaveBeenCalledTimes(1);
    const [command, args] = execFileSpy.mock.calls[0];
    expect(command).toBe("curl");
    expect(Array.isArray(args)).toBe(true);
    const argv = args as string[];
    // The URL and destination must each be their own argv element...
    expect(argv).toContain(maliciousUrl);
    expect(argv).toContain(destPath);
    // ...never merged with other flags into a single shell string.
    expect(argv.filter((a) => a === maliciousUrl)).toHaveLength(1);
    expect(argv.some((a) => typeof a === "string" && a.includes("curl -L"))).toBe(false);
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
