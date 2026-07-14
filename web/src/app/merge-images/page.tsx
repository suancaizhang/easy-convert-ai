"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const MAX_IMAGES = 20;
const MAX_SIZE = 20 * 1024 * 1024;
const ACCEPT = "image/png,image/jpeg,image/webp";

type UploadStatus = "pending" | "uploading" | "done" | "error";

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  documentId: string | null;
  error: string | null;
}

type Stage = "prepare" | "converting" | "done" | "error";

function generateId() {
  return Math.random().toString(36).slice(2);
}

export default function MergeImagesPage() {
  const { user } = useAuth();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [stage, setStage] = useState<Stage>("prepare");
  const [taskId, setTaskId] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [globalError, setGlobalError] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragSrcIndex = useRef<number | null>(null);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files);
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setGlobalError(`最多 ${MAX_IMAGES} 张图片`);
      return;
    }
    const toAdd: ImageItem[] = [];
    for (const file of arr.slice(0, remaining)) {
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        setGlobalError("仅支持 PNG、JPG、WebP 格式");
        continue;
      }
      if (file.size > MAX_SIZE) {
        setGlobalError(`${file.name} 超过 20MB 限制`);
        continue;
      }
      toAdd.push({
        id: generateId(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: "pending",
        progress: 0,
        documentId: null,
        error: null,
      });
    }
    if (arr.length > remaining) {
      setGlobalError(`最多 ${MAX_IMAGES} 张，已忽略超出部分`);
    }
    setImages((prev) => [...prev, ...toAdd]);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }, [images]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const retryUpload = (id: string) => {
    setImages((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "pending", progress: 0, error: null } : i))
    );
  };

  // Drag-and-drop reordering
  const handleDragStart = (index: number) => {
    dragSrcIndex.current = index;
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragSrcIndex.current === null || dragSrcIndex.current === index) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragSrcIndex.current!, 1);
      next.splice(index, 0, moved);
      dragSrcIndex.current = index;
      return next;
    });
  };

  const handleDragEnd = () => {
    dragSrcIndex.current = null;
  };

  const uploadSingle = async (item: ImageItem): Promise<string | null> => {
    setImages((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: "uploading" } : i))
    );
    try {
      const doc = await api.upload<{ id: string }>(
        "/api/documents/upload",
        item.file,
        (pct) =>
          setImages((prev) =>
            prev.map((i) => (i.id === item.id ? { ...i, progress: pct } : i))
          )
      );
      setImages((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "done", progress: 100, documentId: doc.id } : i
        )
      );
      return doc.id;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "上传失败";
      setImages((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "error", error: msg } : i))
      );
      return null;
    }
  };

  const handleMerge = async () => {
    setGlobalError("");
    // upload all pending/error images concurrently
    const toUpload = images.filter((i) => i.status === "pending" || i.status === "error");
    if (toUpload.length > 0) {
      await Promise.all(toUpload.map(uploadSingle));
    }

    // re-read latest state via functional update trick
    setImages((latest) => {
      const failed = latest.filter((i) => i.status === "error");
      if (failed.length > 0) {
        setGlobalError(`${failed.length} 张图片上传失败，请重试后再合并`);
        return latest;
      }

      const docIds = latest.map((i) => i.documentId).filter(Boolean) as string[];
      if (docIds.length < 2) {
        setGlobalError("至少需要 2 张图片");
        return latest;
      }

      // fire merge task asynchronously
      setStage("converting");
      api
        .post<{ id: string; status: string }>("/api/tasks/create-merge", {
          document_ids: docIds,
          task_type: "images_to_pdf",
        })
        .then((task) => {
          setTaskId(task.id);
          setTaskStatus(task.status);
          startPolling(task.id);
        })
        .catch((err) => {
          setStage("error");
          setGlobalError(err instanceof ApiError ? err.message : "合并请求失败");
        });

      return latest;
    });
  };

  const startPolling = (id: string) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60;
    let interval = 2000;

    const poll = async () => {
      try {
        const res = await api.get<{
          status: string;
          error_message?: string;
        }>(`/api/tasks/${id}/status`);
        setTaskStatus(res.status);
        if (res.status === "success") {
          setStage("done");
          return;
        }
        if (res.status === "failed") {
          setStage("error");
          setGlobalError(res.error_message || "合并失败");
          return;
        }
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          setStage("error");
          setGlobalError("转换超时，请稍后在历史记录中查看");
          return;
        }
        if (attempts <= 5) interval = 2000;
        else if (attempts <= 10) interval = 5000;
        else interval = Math.min(interval * 1.5, 15000);
        pollingRef.current = setTimeout(poll, interval);
      } catch {
        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          setStage("error");
          setGlobalError("连接超时，请稍后重试");
          return;
        }
        pollingRef.current = setTimeout(poll, 5000);
      }
    };

    pollingRef.current = setTimeout(poll, 2000);
  };

  const handleDownload = async () => {
    if (!taskId) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8111"}/api/tasks/${taskId}/download`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = "merged.pdf";
      if (disposition) {
        const match = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
        if (match) filename = decodeURIComponent(match[1].replace(/"/g, ""));
      }
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      setGlobalError("下载失败，请重试");
    }
  };

  const handleReset = () => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    images.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setImages([]);
    setStage("prepare");
    setTaskId("");
    setTaskStatus("");
    setGlobalError("");
  };

  const allDone = images.length >= 2 && images.every((i) => i.status === "done");
  const hasError = images.some((i) => i.status === "error");
  const canMerge =
    images.length >= 2 &&
    !images.some((i) => i.status === "uploading") &&
    !hasError;

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative">
      <Link href="/" className="absolute top-4 left-4 text-sm text-gray-400 hover:text-blue-600">
        ← 返回首页
      </Link>

      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">图片合并为 PDF</h1>
          <p className="text-sm text-gray-500 mt-1">最多 20 张 PNG/JPG/WebP，拖拽调整顺序</p>
        </div>

        {stage === "prepare" && (
          <>
            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={handleFileInput}
              />
              <p className="text-gray-500">点击或拖拽图片到此处</p>
              <p className="text-xs text-gray-400 mt-1">PNG、JPG、WebP，每张最大 20MB</p>
            </div>

            {/* Image grid */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3">
                {images.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="relative group rounded-lg overflow-hidden border bg-gray-50 cursor-grab active:cursor-grabbing aspect-square"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />

                    {/* overlay: uploading */}
                    {item.status === "uploading" && (
                      <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center">
                        <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
                        <span className="text-white text-xs mt-1">{item.progress}%</span>
                      </div>
                    )}

                    {/* overlay: done */}
                    {item.status === "done" && (
                      <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {/* overlay: error */}
                    {item.status === "error" && (
                      <div className="absolute inset-0 bg-red-500/70 flex flex-col items-center justify-center gap-1 p-1">
                        <span className="text-white text-xs text-center leading-tight">{item.error}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); retryUpload(item.id); }}
                          className="text-xs bg-white text-red-600 rounded px-2 py-0.5"
                        >
                          重试
                        </button>
                      </div>
                    )}

                    {/* index badge */}
                    <div className="absolute top-1 left-1 w-5 h-5 bg-black/40 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">{index + 1}</span>
                    </div>

                    {/* delete button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(item.id); }}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/40 hover:bg-red-500 text-white rounded-full hidden group-hover:flex items-center justify-center text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {/* add more slot */}
                {images.length < MAX_IMAGES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-500 text-2xl transition-colors"
                  >
                    +
                  </button>
                )}
              </div>
            )}

            {globalError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{globalError}</div>
            )}

            <button
              onClick={handleMerge}
              disabled={images.length < 2 || images.some((i) => i.status === "uploading")}
              className="w-full bg-blue-600 text-white rounded-md py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始合并（{images.length} 张）
            </button>

            {!user && (
              <p className="text-center text-sm text-gray-400">
                游客每日可免费合并 3 次，
                <a href="/register" className="text-blue-600 hover:underline">注册</a>
                后可获得更多次数
              </p>
            )}
          </>
        )}

        {stage === "converting" && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto" />
            <p className="text-gray-600">合并中，请稍候...</p>
            <p className="text-sm text-gray-400">状态: {taskStatus}</p>
          </div>
        )}

        {stage === "done" && (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium">合并完成！</p>
            <button
              onClick={handleDownload}
              className="w-full bg-green-600 text-white rounded-md py-3 font-medium hover:bg-green-700"
            >
              下载 PDF
            </button>
            <button
              onClick={handleReset}
              className="w-full border rounded-md py-3 text-sm hover:bg-gray-50"
            >
              继续合并
            </button>
          </div>
        )}

        {stage === "error" && (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-600">{globalError}</p>
            <button
              onClick={handleReset}
              className="w-full border rounded-md py-3 text-sm hover:bg-gray-50"
            >
              重试
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
