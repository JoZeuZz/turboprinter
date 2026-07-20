import { apiFetch } from "./client";
import type { VideoParams, CreateTaskResponse, TaskStatus, BgmFile } from "./types";

export const videoApi = {
  createTask: (params: VideoParams) =>
    apiFetch<CreateTaskResponse>("/videos", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  getTask: (taskId: string) =>
    apiFetch<TaskStatus>(`/tasks/${taskId}`),

  listTasks: () =>
    apiFetch<Record<string, TaskStatus>>("/tasks"),

  deleteTask: (taskId: string) =>
    apiFetch<void>(`/tasks/${taskId}`, { method: "DELETE" }),

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
};
