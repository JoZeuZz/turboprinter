import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useYouTubePublish, useTikTokPublish, useHashtagGenerator } from "../../hooks/usePublish";
import { useProjectWorkspaceStore } from "../../store/useProjectWorkspaceStore";
import { useVideoStore } from "../../store/useVideoStore";
import { videoApi } from "../../api/video";

vi.mock("../../api/video", () => ({
  videoApi: {
    getYouTubeStatus: vi.fn(),
    getTikTokStatus: vi.fn(),
    selectYouTubeChannel: vi.fn(),
    selectTikTokChannel: vi.fn(),
    uploadToYouTube: vi.fn(),
    uploadToTikTok: vi.fn(),
    generateHashtags: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  useProjectWorkspaceStore.getState().reset();
  useVideoStore.getState().reset();
  useProjectWorkspaceStore.setState({ videoUrls: ["/storage/renders/x/render.mp4"] });
  useVideoStore.getState().set("video_subject", "Gatos ninja: la verdad");
  vi.mocked(videoApi.getYouTubeStatus).mockResolvedValue({
    is_linked: true,
    channel_name: "Mi Canal",
    active_channel_id: "ch1",
    channels: [
      { channelId: "ch1", channelName: "Mi Canal" },
      { channelId: "ch2", channelName: "Otro Canal" },
    ],
  });
  vi.mocked(videoApi.getTikTokStatus).mockResolvedValue({
    is_linked: true,
    channel_name: "Mi TikTok",
    active_channel_id: "tk1",
    channels: [{ channelId: "tk1", channelName: "Mi TikTok" }],
  });
});

describe("useYouTubePublish", () => {
  it("loads the linked status and channels on mount", async () => {
    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.linked).toBe(true));
    expect(result.current.channelName).toBe("Mi Canal");
    expect(result.current.channels).toHaveLength(2);
    expect(result.current.activeChannelId).toBe("ch1");
  });

  it("derives the initial title from the video subject", async () => {
    const { result } = renderHook(() => useYouTubePublish());
    expect(result.current.title).toBe("Gatos ninja");
  });

  it("upload in 'now' mode sends the chosen privacy and no publishAt", async () => {
    vi.mocked(videoApi.uploadToYouTube).mockResolvedValue({ videoId: "abc", url: "https://youtu.be/abc" });
    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.linked).toBe(true));

    act(() => result.current.setPrivacy("unlisted"));
    await act(async () => {
      await result.current.upload();
    });

    expect(videoApi.uploadToYouTube).toHaveBeenCalledWith({
      videoUrl: "/storage/renders/x/render.mp4",
      title: "Gatos ninja",
      description: "",
      privacyStatus: "unlisted",
      publishAt: undefined,
    });
    expect(result.current.status).toBe("success");
    expect(result.current.uploadedUrl).toBe("https://youtu.be/abc");
  });

  it("upload in 'schedule' mode forces private and sends an ISO publishAt", async () => {
    vi.mocked(videoApi.uploadToYouTube).mockResolvedValue({ videoId: "abc", url: "https://youtu.be/abc" });
    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.linked).toBe(true));

    act(() => {
      result.current.setMode("schedule");
      result.current.setPublishDate("2026-08-01");
      result.current.setPublishTime("18:30");
    });
    await act(async () => {
      await result.current.upload();
    });

    const call = vi.mocked(videoApi.uploadToYouTube).mock.calls[0][0];
    expect(call.privacyStatus).toBe("private");
    expect(new Date(call.publishAt!).getTime()).toBe(new Date(2026, 7, 1, 18, 30).getTime());
  });

  it("upload failure surfaces the error message", async () => {
    vi.mocked(videoApi.uploadToYouTube).mockRejectedValue(new Error("quota exceeded"));
    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.linked).toBe(true));

    await act(async () => {
      await result.current.upload();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("quota exceeded");
  });

  it("selectChannel switches the active channel and refreshes the status", async () => {
    vi.mocked(videoApi.selectYouTubeChannel).mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useYouTubePublish());
    await waitFor(() => expect(result.current.linked).toBe(true));

    await act(async () => {
      await result.current.selectChannel("ch2");
    });

    expect(videoApi.selectYouTubeChannel).toHaveBeenCalledWith("ch2");
    expect(videoApi.getYouTubeStatus).toHaveBeenCalledTimes(2);
  });
});

describe("useTikTokPublish", () => {
  it("uploads with the edited caption and records the returned url", async () => {
    vi.mocked(videoApi.uploadToTikTok).mockResolvedValue({ publishId: "1", url: "https://tiktok.com/v/1" });
    const { result } = renderHook(() => useTikTokPublish());
    await waitFor(() => expect(result.current.linked).toBe(true));

    act(() => result.current.setTitle("Mi caption #viral"));
    await act(async () => {
      await result.current.upload();
    });

    expect(videoApi.uploadToTikTok).toHaveBeenCalledWith({
      videoUrl: "/storage/renders/x/render.mp4",
      title: "Mi caption #viral",
    });
    expect(result.current.status).toBe("success");
    expect(result.current.uploadedUrl).toBe("https://tiktok.com/v/1");
  });

  it("upload failure surfaces the error message", async () => {
    vi.mocked(videoApi.uploadToTikTok).mockRejectedValue(new Error("draft inbox full"));
    const { result } = renderHook(() => useTikTokPublish());
    await waitFor(() => expect(result.current.linked).toBe(true));

    await act(async () => {
      await result.current.upload();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("draft inbox full");
  });
});

describe("useHashtagGenerator", () => {
  it("reports an error when there are no keywords to work with", async () => {
    const { result } = renderHook(() => useHashtagGenerator());
    let out: string | null = null;
    await act(async () => {
      out = await result.current.generate();
    });
    expect(out).toBeNull();
    expect(result.current.error).toMatch(/palabras clave/i);
    expect(videoApi.generateHashtags).not.toHaveBeenCalled();
  });

  it("returns the generated hashtags for the current video context", async () => {
    useVideoStore.getState().set("video_terms", "gatos, ninja");
    vi.mocked(videoApi.generateHashtags).mockResolvedValue({ hashtags: "#gatos #ninja" });

    const { result } = renderHook(() => useHashtagGenerator());
    let out: string | null = null;
    await act(async () => {
      out = await result.current.generate();
    });

    expect(out).toBe("#gatos #ninja");
    expect(result.current.error).toBeNull();
  });
});
