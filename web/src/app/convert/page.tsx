"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_SIZE = 20 * 1024 * 1024;

const TASK_TYPE_OPTIONS: Record<string, { label: string; value: string }[]> = {
  pdf: [
    { label: "PDF → Word", value: "pdf_to_word" },
    { label: "PDF → 图片", value: "pdf_to_image" },
  ],
  docx: [{ label: "Word → PDF", value: "word_to_pdf" }],
  xlsx: [{ label: "Excel → PDF", value: "excel_to_pdf" }],
  pptx: [{ label: "PPT → PDF", value: "ppt_to_pdf" }],
  png: [
    { label: "OCR 识别 → Word", value: "ocr_to_word" },
    { label: "图片 → PDF", value: "images_to_pdf" },
  ],
  jpg: [
    { label: "OCR 识别 → Word", value: "ocr_to_word" },
    { label: "图片 → PDF", value: "images_to_pdf" },
  ],
  webp: [
    { label: "OCR 识别 → Word", value: "ocr_to_word" },
    { label: "图片 → PDF", value: "images_to_pdf" },
  ],
};

type Stage = "upload" | "converting" | "done" | "error";

export default function ConvertPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [taskType, setTaskType] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileExt = (f: File): string => {
    const name = f.name.toLowerCase();
    if (name.endsWith(".pdf")) return "pdf";
    if (name.endsWith(".docx")) return "docx";
    if (name.endsWith(".xlsx")) return "xlsx";
    if (name.endsWith(".pptx")) return "pptx";
    if (name.endsWith(".png")) return "png";
    if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpg";
    if (name.endsWith(".webp")) return "webp";
    return "";
  };

  const handleFileSelect = (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type) && !getFileExt(f)) {
      setError("不支持的文件格式");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("文件大小超过 20MB 限制");
      return;
    }
    setFile(f);
    setError("");
    const ext = getFileExt(f);
    const options = TASK_TYPE_OPTIONS[ext];
    if (options && options.length === 1) {
      setTaskType(options[0].value);
    } else {
      setTaskType("");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const handleUploadAndConvert = async () => {
    if (!file || !taskType) return;
    setError("");
    setStage("converting");
    setUploadProgress(0);

    try {
      const doc = await api.upload<{ id: string }>(
        "/api/documents/upload",
        file,
        setUploadProgress
      );
      setDocumentId(doc.id);

      const task = await api.post<{ id: string; status: string }>(
        "/api/tasks/create",
        { document_id: doc.id, task_type: taskType }
      );
      setTaskId(task.id);
      setTaskStatus(task.status);
      startPolling(task.id);
    } catch (err) {
      setStage("error");
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("操作失败，请重试");
      }
    }
  };

  const startPolling = (id: string) => {
    let interval = 2000;
    let attempts = 0;
    const MAX_ATTEMPTS = 60;

    const poll = async () => {
      try {
        const res = await api.get<{
          status: string;
          error_message?: string;
          error_code?: string;
        }>(`/api/tasks/${id}/status`);

        setTaskStatus(res.status);

        if (res.status === "success") {
          setStage("done");
          return;
        }
        if (res.status === "failed") {
          setStage("error");
          setError(res.error_message || "转换失败");
          return;
        }

        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          setStage("error");
          setError("转换超时，请稍后在历史记录中查看结果");
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
          setError("连接超时，请稍后重试");
          return;
        }
        pollingRef.current = setTimeout(poll, 5000);
      }
    };

    pollingRef.current = setTimeout(poll, 2000);
  };

  const handleDownload = async () => {
    if (!taskId) return;
    const token = localStorage.getItem("token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/tasks/${taskId}/download`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("下载失败");
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition");
      let filename = "converted_file";
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
      setError("下载失败，请重试");
    }
  };

  const handleReset = () => {
    if (pollingRef.current) clearTimeout(pollingRef.current);
    setStage("upload");
    setFile(null);
    setUploadProgress(0);
    setTaskType("");
    setDocumentId("");
    setTaskId("");
    setError("");
    setTaskStatus("");
  };

  const ext = file ? getFileExt(file) : "";
  const options = ext ? TASK_TYPE_OPTIONS[ext] || [] : [];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-center">文档转换</h1>

        {stage === "upload" && (
          <>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
              {file ? (
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500">拖拽文件到此处，或点击选择文件</p>
                  <p className="text-xs text-gray-400 mt-2">
                    支持 PDF、Word、Excel、PPT、PNG、JPG、WebP（最大 20MB）
                  </p>
                </div>
              )}
            </div>

            {file && options.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-2">选择转换类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTaskType(opt.value)}
                      className={`px-3 py-2 rounded-md text-sm border ${
                        taskType === opt.value
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">
                {error}
              </div>
            )}

            <button
              onClick={handleUploadAndConvert}
              disabled={!file || !taskType}
              className="w-full bg-blue-600 text-white rounded-md py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              开始转换
            </button>
          </>
        )}

        {stage === "converting" && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto" />
            <p className="text-gray-600">
              {uploadProgress < 100 ? `上传中 ${uploadProgress}%` : "转换中，请稍候..."}
            </p>
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
            <p className="font-medium">转换完成！</p>
            <button
              onClick={handleDownload}
              className="w-full bg-green-600 text-white rounded-md py-3 font-medium hover:bg-green-700"
            >
              下载文件
            </button>
            <button
              onClick={handleReset}
              className="w-full border rounded-md py-3 text-sm hover:bg-gray-50"
            >
              继续转换
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
            <p className="text-red-600">{error}</p>
            <button
              onClick={handleReset}
              className="w-full border rounded-md py-3 text-sm hover:bg-gray-50"
            >
              重试
            </button>
          </div>
        )}

        {!user && stage === "upload" && (
          <p className="text-center text-sm text-gray-400">
            游客每日可免费转换 3 次，
            <a href="/register" className="text-blue-600 hover:underline">注册</a>
            后可获得更多次数
          </p>
        )}
      </div>
    </main>
  );
}
