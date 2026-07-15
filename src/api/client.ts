// webui-react/src/api/client.ts
import i18n from "../i18n";

const API_BASE = "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...headers,
      ...options?.headers,
    },
    ...options,
  });

  const json = await response.json();

  if (!response.ok || (json.status != null && json.status >= 400)) {
    throw new ApiError(
      json.status ?? response.status,
      json.message ?? i18n.t("errors.requestFailed")
    );
  }

  return json.data as T;
}

export async function apiBlobFetch(
  path: string,
  options?: RequestInit
): Promise<Blob> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = isFormData ? {} : { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...headers,
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let message = i18n.t("errors.requestFailed");
    try {
      const json = await response.json();
      message = json.message ?? message;
    } catch {
      // Non-JSON error responses are still surfaced with a generic message.
    }
    throw new ApiError(response.status, message);
  }

  return response.blob();
}
