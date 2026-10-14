"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { api, ApiError } from "@/lib/api";
import { downloadTaskFile } from "./fetchTaskFile";
import { getTranslation as t } from "./i18n";

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
  const operationRef = useRef<AbortController | null>(null);

  // One controller owns a run, including uploads, polling and downloads. Checking
  // it after every await also guards transports/callbacks that cannot be aborted.
  const stop = useCallback(() => {
    operationRef.current?.abort();
    if (pollingRef.current !== null) clearTimeout(pollingRef.current);
    pollingRef.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const reset = useCallback(() => {
    stop();
    setStage("idle");
    setUploadProgress(0);
    setConversionProgress(0);
    setProgressDetail(null);
    setTaskStatus("");
    setError("");
    setTaskId("");
    setShowPreview(false);
  }, [stop]);

  const startPolling = useCallback((id: string, signal: AbortSignal) => {
    let attempts = 0;
    let interval = 2000;
    const poll = async () => {
      if (signal.aborted) return;
      pollingRef.current = null;
      try {
        const res = await api.get<StatusResponse>(`/api/tasks/${id}/status`, { signal });
        if (signal.aborted) return;
        setTaskStatus(res.status);
        if (res.progress != null) setConversionProgress(res.progress);
        if (res.progress_current != null && res.progress_total != null) {
          setProgressDetail({ current: res.progress_current, total: res.progress_total });
        }
        if (res.status === "success") {
          setConversionProgress(100);
          setError("");
          setStage("done");
          return;
        }
        if (res.status === "failed") {
          setStage("error");
          setError(res.error_message || t("tool.conversionFailed"));
          return;
        }
        attempts++;
        if (attempts >= maxAttempts) {
          setStage("error");
          setError(t("tool.taskTimeout"));
          return;
        }
        interval = res.progress != null && (res.progress_total ?? 0) > 5 || attempts <= 5
          ? 2000 : attempts <= 10 ? 5000 : Math.min(interval * 1.5, 15000);
      } catch {
        if (signal.aborted) return;
        attempts++;
        if (attempts >= maxAttempts) {
          setStage("error");
          setError(t("tool.connectionTimeout"));
          return;
        }
        interval = 5000;
      }
      if (!signal.aborted) pollingRef.current = setTimeout(poll, interval);
    };
    pollingRef.current = setTimeout(poll, 2000);
  }, [maxAttempts]);

  const uploadAndRun = useCallback(async (files: File[], params?: Record<string, unknown>) => {
    reset();
    const controller = new AbortController();
    operationRef.current = controller;
    const { signal } = controller;
    setStage("uploading");
    try {
      const documentIds: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const doc = await api.upload<{ id: string }>("/api/documents/upload", files[i], (pct) => {
          if (!signal.aborted) setUploadProgress(Math.round((i * 100 + pct) / files.length));
        }, signal);
        if (signal.aborted) return;
        documentIds.push(doc.id);
      }
      setUploadProgress(100);
      setStage("converting");
      const id = await createTask(documentIds, params);
      if (signal.aborted) return;
      setTaskId(id);
      setTaskStatus("waiting");
      startPolling(id, signal);
    } catch (err) {
      if (signal.aborted) return;
      setStage("error");
      setError(err instanceof ApiError ? err.message : t("tool.operationFailed"));
    }
  }, [createTask, reset, startPolling]);

  const cancel = useCallback(async () => {
    const signal = operationRef.current?.signal;
    if (!taskId || !signal || signal.aborted) return;
    try {
      await api.post(`/api/tasks/${taskId}/cancel`, undefined, { signal });
      if (!signal.aborted) reset();
    } catch (err) {
      if (signal.aborted) return;
      // A rejected cancellation leaves the same run polling normally.
      setError(err instanceof ApiError && err.status === 409 ? t("cancel.cannotCancel") : t("tool.cancelFailed"));
    }
  }, [taskId, reset]);

  const download = useCallback(async () => {
    const signal = operationRef.current?.signal;
    if (!taskId || !signal || signal.aborted) return;
    setError("");
    try {
      await downloadTaskFile(taskId, signal);
    } catch {
      if (!signal.aborted) setError(t("tool.downloadFailed"));
    }
  }, [taskId]);
  const preview = useCallback(() => setShowPreview(true), []);
  const closePreview = useCallback(() => setShowPreview(false), []);
  const canCancel = stage === "converting" && taskStatus === "waiting";

  return {
    stage, uploadProgress, conversionProgress, progressDetail,
    taskStatus, error, taskId, showPreview, canCancel,
    uploadAndRun, download, preview, closePreview, reset, cancel,
  };
}
