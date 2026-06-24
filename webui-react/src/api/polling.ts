// webui-react/src/api/polling.ts
import { apiFetch } from "./client";
import {
  TaskStatus,
  TASK_STATE_COMPLETE,
  TASK_STATE_FAILED,
} from "./types";

export function pollTask(
  taskId: string,
  onProgress: (status: TaskStatus) => void,
  intervalMs = 1500
): Promise<TaskStatus> {
  return new Promise((resolve, reject) => {
    const timerId = setInterval(async () => {
      try {
        const status = await apiFetch<TaskStatus>(`/tasks/${taskId}`);
        onProgress(status);
        if (
          status.state === TASK_STATE_COMPLETE ||
          status.state === TASK_STATE_FAILED
        ) {
          clearInterval(timerId);
          if (status.state === TASK_STATE_FAILED) {
            reject(new Error("Task failed on server"));
          } else {
            resolve(status);
          }
        }
      } catch (err) {
        clearInterval(timerId);
        reject(err);
      }
    }, intervalMs);
  });
}
