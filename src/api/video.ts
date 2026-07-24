import { apiFetch } from "./client";
import type { BgmFile } from "./types";

export const videoApi = {
  getBgmList: () =>
    apiFetch<{ files: BgmFile[] }>("/musics"),

  getLocalVideos: () =>
    apiFetch<{ files: { name: string; size: number; path: string }[] }>("/local-videos"),

  uploadLocalVideo: (file: File) => {
    const formData = new FormData();
    formData.append("video", file);
    return apiFetch<{ name: string; size: number; path: string }>("/local-videos/upload", {
      method: "POST",
      body: formData,
    });
  },

  generateHashtags: (params: { video_terms: string | string[]; video_subject?: string; video_script?: string }) =>
    apiFetch<{ hashtags: string }>("/hashtags", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getYouTubeStatus: () =>
    apiFetch<{ is_linked: boolean; channel_name: string | null; active_channel_id?: string | null; channels?: Array<{ channelId: string; channelName: string }> }>("/youtube/status"),

  getYouTubeAuthUrl: () =>
    apiFetch<{ url: string }>("/youtube/auth-url"),

  disconnectYouTube: () =>
    apiFetch<void>("/youtube/disconnect", { method: "POST" }),

  selectYouTubeChannel: (channelId: string) =>
    apiFetch<{ status: number; message: string; activeChannelId: string }>("/youtube/select-channel", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  disconnectYouTubeChannel: (channelId: string) =>
    apiFetch<{ status: number; message: string }>("/youtube/disconnect-channel", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  uploadToYouTube: (params: { videoUrl: string; title: string; description: string; privacyStatus?: "public" | "private" | "unlisted"; publishAt?: string }) =>
    apiFetch<{ videoId: string; url: string }>("/youtube/upload", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getTikTokStatus: () =>
    apiFetch<{ is_linked: boolean; channel_name: string | null; active_channel_id?: string | null; channels?: Array<{ channelId: string; channelName: string; username?: string; avatarUrl?: string }> }>("/tiktok/status"),

  getTikTokAuthUrl: () =>
    apiFetch<{ url: string }>("/tiktok/auth-url"),

  disconnectTikTok: () =>
    apiFetch<void>("/tiktok/disconnect", { method: "POST" }),

  selectTikTokChannel: (channelId: string) =>
    apiFetch<{ status: number; message: string; activeChannelId: string }>("/tiktok/select-channel", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  disconnectTikTokChannel: (channelId: string) =>
    apiFetch<{ status: number; message: string }>("/tiktok/disconnect-channel", {
      method: "POST",
      body: JSON.stringify({ channelId }),
    }),

  uploadToTikTok: (params: { videoUrl: string; title: string }) =>
    apiFetch<{ publishId: string; url: string }>("/tiktok/upload", {
      method: "POST",
      body: JSON.stringify(params),
    }),
};
