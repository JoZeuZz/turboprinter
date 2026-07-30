// webui-react/src/api/polling.ts
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
