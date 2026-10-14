import { request } from "./api";

interface FetchTaskFileOptions {
  path?: string;
  preview?: boolean;
  json?: boolean;
  signal?: AbortSignal;
}

export async function fetchTaskFile(
  taskId: string,
  { path = "/download", preview = false, json = false, signal }: FetchTaskFileOptions = {},
): Promise<Blob | Record<string, unknown>> {
  const base = `/api/tasks/${taskId}${path}`;
  const url = preview ? `${base}${base.includes("?") ? "&" : "?"}preview=1` : base;
  return request<Blob | Record<string, unknown>>(url, { signal }, (res) => json ? res.json() : res.blob());
}

export async function downloadTaskFile(taskId: string, signal?: AbortSignal): Promise<void> {
  const { blob, disposition } = await request(`/api/tasks/${taskId}/download`, { signal }, async (res) => ({
    blob: await res.blob(), disposition: res.headers.get("content-disposition"),
  }));
  if (signal?.aborted) return;
  let filename = "converted_file";
  const match = disposition?.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  if (match) {
    try { filename = decodeURIComponent(match[1]); } catch { filename = match[1]; }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Give the browser a turn to acquire the download before releasing its URL.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
