/**
 * 通用任务文件请求工具
 * 从 useToolPage.ts 的 fetchResult 逻辑中提取，供预览组件复用
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8111";

function getAuthHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

interface FetchTaskFileOptions {
  /** 额外路径后缀，如 "/pages" 或 "/download/0" */
  path?: string;
  /** 是否为预览模式（添加 ?preview=1） */
  preview?: boolean;
  /** 是否解析为 JSON（否则返回 Blob） */
  json?: boolean;
}

/**
 * 请求任务相关文件
 * @returns json=true 时返回解析后的对象；否则返回 Blob
 */
export async function fetchTaskFile(
  taskId: string,
  options: FetchTaskFileOptions = {}
): Promise<Blob | Record<string, unknown>> {
  const { path = "/download", preview = false, json = false } = options;

  const base = `${API_URL}/api/tasks/${taskId}${path}`;
  const url = preview ? `${base}${base.includes("?") ? "&" : "?"}preview=1` : base;

  const res = await fetch(url, { headers: getAuthHeaders() });

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  if (json) {
    return (await res.json()) as Record<string, unknown>;
  }

  return await res.blob();
}
