// webui-react/src/api/polling.ts
import { apiFetch } from "./client";
import {
  TaskStatus,
  TASK_STATE_COMPLETE,
  TASK_STATE_FAILED,
} from "./types";

export async function pollUntilComplete<T>(
  fetchStatus: () => Promise<T>,
  onProgress: (status: T) => void,
  isComplete: (status: T) => boolean,
  intervalMs = 1500
): Promise<T> {
  for (;;) {
    const status = await fetchStatus();
    onProgress(status);

    if (isComplete(status)) {
      return status;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export function pollTask(
  taskId: string,
  onProgress: (status: TaskStatus) => void,
  intervalMs = 1500
): Promise<TaskStatus> {
  return pollUntilComplete(
    () => apiFetch<TaskStatus>(`/tasks/${taskId}`),
    onProgress,
    (status) =>
      status.state === TASK_STATE_COMPLETE || status.state === TASK_STATE_FAILED,
    intervalMs
  ).then((status) => {
    if (status.state === TASK_STATE_FAILED) {
      throw new Error("Task failed on server");
    }

    return status;
  });
}
