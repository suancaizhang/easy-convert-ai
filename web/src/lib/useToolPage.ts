"use client";

import { useState, useRef, useCallback } from "react";
import { api, ApiError } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8111";

export type ToolStage = "idle" | "uploading" | "converting" | "done" | "error";

export interface ProgressDetail {
  current: number;
  total: number;
}

export interface ToolPageState {
  stage: ToolStage;
  uploadProgress: number;
  conversionProgress: number;
  progressDetail: ProgressDetail | null;
  taskStatus: string;
  error: string;
}

export interface UseToolPageOptions {
  /** Called after all files are uploaded. Returns the task id. */
  createTask: (documentIds: string[], params?: Record<string, unknown>) => Promise<string>;
  /** Max polling attempts before timeout (default 60) */
  maxAttempts?: number;
}

export interface UseToolPageReturn extends ToolPageState {
  uploadAndRun: (files: File[], params?: Record<string, unknown>) => Promise<void>;
  download: () => Promise<void>;
  preview: () => void;
  reset: () => void;
  cancel: () => Promise<void>;
  canCancel: boolean;
  taskId: string;
  showPreview: boolean;
  closePreview: () => void;
}

interface StatusResponse {
  status: string;
  error_message?: string;
  error_code?: string;
  progress?: number;
  progress_current?: number;
  progress_total?: number;
}

export function useToolPage({ createTask, maxAttempts = 60 }: UseToolPageOptions): UseToolPageReturn {
  const [stage, setStage] = useState<ToolStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [progressDetail, setProgressDetail] = useState<ProgressDetail | null>(null);
  const [taskStatus, setTaskStatus] = useState("");
  const [error, setError] = useState("");
  const [taskId, setTaskId] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const startPolling = useCallback((id: string) => {
    let attempts = 0;
    let interval = 2000;
    let hasProgress = false;

    const poll = async () => {
      try {
        const res = await api.get<StatusResponse>(`/api/tasks/${id}/status`);
        setTaskStatus(res.status);

        // Update progress if available
        if (res.progress != null) {
          hasProgress = true;
          setConversionProgress(res.progress);
          if (res.progress_current != null && res.progress_total != null) {
            setProgressDetail({ current: res.progress_current, total: res.progress_total });
          }
        }

        if (res.status === "success") {
          setConversionProgress(100);
          setStage("done");
          return;
        }
        if (res.status === "failed") {
          setStage("error");
          setError(res.error_message || "转换失败");
          return;
        }

        attempts++;
        if (attempts >= maxAttempts) {
          setStage("error");
          setError("任务超时，请重试");
          return;
        }

        // Keep fast polling when progress is active (total > 5 items)
        if (hasProgress && res.progress_total && res.progress_total > 5) {
          interval = 2000;
        } else if (attempts <= 5) {
          interval = 2000;
        } else if (attempts <= 10) {
          interval = 5000;
        } else {
          interval = Math.min(interval * 1.5, 15000);
        }

        pollingRef.current = setTimeout(poll, interval);
      } catch {
        attempts++;
        if (attempts >= maxAttempts) {
          setStage("error");
          setError("连接超时，请重试");
          return;
        }
        pollingRef.current = setTimeout(poll, 5000);
      }
    };

    pollingRef.current = setTimeout(poll, 2000);
  }, [maxAttempts]);

  const uploadAndRun = useCallback(async (files: File[], params?: Record<string, unknown>) => {
    setError("");
    setStage("uploading");
    setUploadProgress(0);
    setConversionProgress(0);
    setProgressDetail(null);

    try {
      const total = files.length;
      const documentIds: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const doc = await api.upload<{ id: string }>(
          "/api/documents/upload",
          files[i],
          (pct) => setUploadProgress(Math.round((i * 100 + pct) / total))
        );
        documentIds.push(doc.id);
      }

      setUploadProgress(100);
      setStage("converting");

      const id = await createTask(documentIds, params);
      setTaskId(id);
      setTaskStatus("waiting");
      startPolling(id);
    } catch (err) {
      setStage("error");
      setError(err instanceof ApiError ? err.message : "操作失败，请重试");
    }
  }, [createTask, startPolling]);

  const cancel = useCallback(async () => {
    if (!taskId) return;
    try {
      await api.post(`/api/tasks/${taskId}/cancel`);
      stopPolling();
      setStage("idle");
      setTaskStatus("");
      setConversionProgress(0);
      setProgressDetail(null);
      setTaskId("");
    } catch {
      // 409 or other error — task already processing, let polling continue
    }
  }, [taskId]);

  const canCancel = stage === "converting" && taskStatus === "waiting";

  const fetchResult = useCallback(async (preview: boolean): Promise<void> => {
    if (!taskId) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const url = `${API_URL}/api/tasks/${taskId}/download${preview ? "?preview=1" : ""}`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error("请求失败");
    const blob = await res.blob();

    if (preview) {
      window.open(URL.createObjectURL(blob), "_blank");
      return;
    }

    const disposition = res.headers.get("content-disposition");
    let filename = "converted_file";
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
      if (match) filename = decodeURIComponent(match[1].replace(/"/g, ""));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [taskId]);

  const download = useCallback(async () => {
    try {
      await fetchResult(false);
    } catch {
      setError("下载失败，请重试");
    }
  }, [fetchResult]);

  const preview = useCallback(() => {
    setShowPreview(true);
  }, []);

  const closePreview = useCallback(() => {
    setShowPreview(false);
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setStage("idle");
    setUploadProgress(0);
    setConversionProgress(0);
    setProgressDetail(null);
    setTaskStatus("");
    setError("");
    setTaskId("");
    setShowPreview(false);
  }, []);

  return {
    stage, uploadProgress, conversionProgress, progressDetail,
    taskStatus, error, taskId, showPreview, canCancel,
    uploadAndRun, download, preview, closePreview, reset, cancel,
  };
}
