import { getTranslation } from "@/lib/i18n";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8111";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function errorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((entry) => {
      if (!entry || typeof entry.msg !== "string") return [];
      const location = Array.isArray(entry.loc)
        ? entry.loc.filter((part: unknown) => part !== "body").join(".") : "";
      return [location ? `${location}: ${entry.msg}` : entry.msg];
    });
    if (messages.length) return messages.join("; ");
  }
  return fallback;
}

// Consume the body inside the deadline too: headers alone do not finish a request.
export async function request<T>(
  path: string,
  options: RequestInit = {},
  consume: (response: Response) => Promise<T> = (response) => response.json(),
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const controller = new AbortController();
  const abort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 30_000);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...options, headers, signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new ApiError(errorMessage(body?.detail, getTranslation("api.requestFailed")), res.status);
    }
    if (res.status === 204) return undefined as T;
    return await consume(res);
  } catch (error) {
    if (timedOut) throw new ApiError(getTranslation("api.timeout"), 0);
    if (controller.signal.aborted) throw error;
    if (error instanceof ApiError) throw error;
    throw new ApiError(getTranslation("api.networkError"), 0);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, options),
  post: <T>(path: string, data?: unknown, options?: RequestInit) =>
    request<T>(path, { ...options, method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: async <T>(path: string, file: File, onProgress?: (pct: number) => void, signal?: AbortSignal): Promise<T> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    // Node 20 and older supported browsers do not expose Promise.withResolvers.
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => signal?.removeEventListener("abort", abort);
      const fail = (error: unknown) => { cleanup(); reject(error); };
      xhr.open("POST", `${API_URL}${path}`);
      xhr.timeout = 120_000;
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100));
        };
      }
      xhr.onload = () => {
        cleanup();
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.status === 204 ? undefined as T : JSON.parse(xhr.responseText));
          } else {
            const body = JSON.parse(xhr.responseText || "null");
            reject(new ApiError(errorMessage(body?.detail, getTranslation("api.uploadFailed")), xhr.status));
          }
        } catch {
          reject(new ApiError(getTranslation("api.uploadFailed"), xhr.status));
        }
      };
      xhr.onerror = () => fail(new ApiError(getTranslation("api.networkError"), 0));
      xhr.onabort = () => fail(new ApiError(getTranslation("api.uploadFailed"), 0));
      xhr.ontimeout = () => fail(new ApiError(getTranslation("api.timeout"), 0));
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) { fail(signal.reason); return; }
      const formData = new FormData();
      formData.append("file", file);
      xhr.send(formData);
    });
  },
};
