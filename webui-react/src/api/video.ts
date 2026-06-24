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
};
