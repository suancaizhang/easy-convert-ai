"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { TranslationKeys } from "@/i18n/types";

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

const TASK_TYPE_OPTIONS: Record<string, { labelKey: keyof TranslationKeys; value: string }[]> = {
  pdf: [
    { labelKey: "taskType.pdfToWord", value: "pdf_to_word" },
    { labelKey: "taskType.pdfToImage", value: "pdf_to_image" },
  ],
  docx: [{ labelKey: "taskType.wordToPdf", value: "word_to_pdf" }],
  xlsx: [{ labelKey: "taskType.excelToPdf", value: "excel_to_pdf" }],
  pptx: [{ labelKey: "taskType.pptToPdf", value: "ppt_to_pdf" }],
  png: [
    { labelKey: "taskType.ocrToWord", value: "ocr_to_word" },
    { labelKey: "taskType.imagesToPdf", value: "images_to_pdf" },
  ],
  jpg: [
    { labelKey: "taskType.ocrToWord", value: "ocr_to_word" },
    { labelKey: "taskType.imagesToPdf", value: "images_to_pdf" },
  ],
  webp: [
    { labelKey: "taskType.ocrToWord", value: "ocr_to_word" },
    { labelKey: "taskType.imagesToPdf", value: "images_to_pdf" },
  ],
};

type Stage = "upload" | "converting" | "done" | "error";

const VALID_TASK_TYPES = [
  "pdf_to_word",
  "pdf_to_image",
  "word_to_pdf",
  "excel_to_pdf",
  "ppt_to_pdf",
  "images_to_pdf",
  "ocr_to_word",
] as const;

const TASK_TO_ACCEPT_EXT: Record<string, string[]> = {
  pdf_to_word: ["pdf"],
  pdf_to_image: ["pdf"],
  word_to_pdf: ["docx"],
  excel_to_pdf: ["xlsx"],
  ppt_to_pdf: ["pptx"],
  images_to_pdf: ["png", "jpg", "jpeg", "webp"],
  ocr_to_word: ["png", "jpg", "jpeg", "webp"],
};

const PREVIEWABLE_TYPES: Record<string, boolean> = {
  pdf_to_word: false,
  pdf_to_image: true,
  word_to_pdf: true,
  excel_to_pdf: true,
  ppt_to_pdf: true,
  images_to_pdf: true,
  ocr_to_word: false,
};

const PREVIEW_LABEL_KEYS: Record<string, keyof TranslationKeys> = {
  pdf_to_image: "convert.previewImage",
  word_to_pdf: "convert.previewPdf",
  excel_to_pdf: "convert.previewPdf",
  ppt_to_pdf: "convert.previewPdf",
  images_to_pdf: "convert.previewPdf",
};

const TASK_LABEL_KEYS: Record<string, keyof TranslationKeys> = {
  pdf_to_word: "taskType.pdfToWord",
  pdf_to_image: "taskType.pdfToImage",
  word_to_pdf: "taskType.wordToPdf",
  excel_to_pdf: "taskType.excelToPdf",
  ppt_to_pdf: "taskType.pptToPdf",
  images_to_pdf: "taskType.imagesToPdf",
  ocr_to_word: "taskType.ocrToWord",
};

export default function ConvertPage() {
  return (
    <Suspense>
      <ConvertPageInner />
    </Suspense>
  );
}

function ConvertPageInner() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const presetTaskType = (() => {
    const param = searchParams.get("taskType");
    if (param && (VALID_TASK_TYPES as readonly string[]).includes(param)) {
      return param;
    }
    return null;
  })();

  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [taskType, setTaskType] = useState(presetTaskType || "");
  const [documentId, setDocumentId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState("");
  const [taskStatus, setTaskStatus] = useState("");
  const [outputTaskType, setOutputTaskType] = useState("");
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
      setError(t("convert.unsupportedFormat"));
      return;
    }
    if (f.size > MAX_SIZE) {
      setError(t("convert.fileTooLarge"));
      return;
    }

    const ext = getFileExt(f);

    if (presetTaskType) {
      const allowedExts = TASK_TO_ACCEPT_EXT[presetTaskType] || [];
      if (!allowedExts.includes(ext)) {
        setError(t("convert.formatMismatch", { formats: allowedExts.map(e => `.${e}`).join("、") }));
        return;
      }
    }

    setFile(f);
    setError("");

    if (!presetTaskType) {
      const options = TASK_TYPE_OPTIONS[ext];
      if (options && options.length === 1) {
        setTaskType(options[0].value);
      } else {
        setTaskType("");
      }
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
      setOutputTaskType(taskType);
      startPolling(task.id);
    } catch (err) {
      setStage("error");
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("convert.operationFailed"));
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
          setError(res.error_message || t("convert.convertFailed"));
          return;
        }

        attempts++;
        if (attempts >= MAX_ATTEMPTS) {
          setStage("error");
          setError(t("convert.timeout"));
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
          setError(t("convert.connectionTimeout"));
          return;
        }
        pollingRef.current = setTimeout(poll, 5000);
      }
    };

    pollingRef.current = setTimeout(poll, 2000);
  };

  const handlePreview = () => {
    if (!taskId || !outputTaskType) return;
    const token = localStorage.getItem("token");
    const url = `${
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8111"
    }/api/tasks/${taskId}/download?preview=1`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("preview failed");
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      })
      .catch(() => setError(t("convert.previewFailed")));
  };

  const handleDownload = async () => {
    if (!taskId) return;
    const token = localStorage.getItem("token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8111"}/api/tasks/${taskId}/download`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error("download failed");
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
      setError(t("convert.downloadFailed"));
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
    setOutputTaskType("");
  };

  const handleDelete = async () => {
    if (!documentId) return;
    if (!confirm(t("convert.deleteConfirm"))) return;

    try {
      await api.delete(`/api/documents/${documentId}`);
      handleReset();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(t("convert.deleteFailed"));
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (!presetTaskType) {
      setTaskType("");
    }
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const ext = file ? getFileExt(file) : "";
  const options = ext ? TASK_TYPE_OPTIONS[ext] || [] : [];

  const acceptFilter = presetTaskType
    ? (TASK_TO_ACCEPT_EXT[presetTaskType] || []).map((e) => `.${e}`).join(",")
    : ".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp";

  const pageTitle = presetTaskType && TASK_LABEL_KEYS[presetTaskType]
    ? t(TASK_LABEL_KEYS[presetTaskType])
    : t("convert.title");

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative">
      <Link href="/" className="absolute top-4 left-4 text-sm text-gray-400 hover:text-blue-600">
        {t("nav.backHome")}
      </Link>
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-center">{pageTitle}</h1>

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
                accept={acceptFilter}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
              {file ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile();
                    }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-red-100 text-gray-500 hover:text-red-500 rounded-full flex items-center justify-center text-sm"
                    title={t("convert.removeFile")}
                  >
                    ×
                  </button>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-gray-500">{t("convert.dropzone")}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {presetTaskType
                      ? t("convert.dropzoneHintPreset", { formats: (TASK_TO_ACCEPT_EXT[presetTaskType] || []).map(e => e.toUpperCase()).join("、") })
                      : t("convert.dropzoneHint")}
                  </p>
                </div>
              )}
            </div>

            {file && !presetTaskType && options.length > 1 && (
              <div>
                <label className="block text-sm font-medium mb-2">{t("convert.selectType")}</label>
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
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {file && !presetTaskType && options.length === 1 && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-2">
                <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t("convert.conversionType")}<span className="font-medium text-gray-800">{t(options[0].labelKey)}</span></span>
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
              {t("convert.startConvert")}
            </button>
          </>
        )}

        {stage === "converting" && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto" />
            <p className="text-gray-600">
              {uploadProgress < 100
                ? t("convert.uploading", { progress: uploadProgress })
                : t("convert.converting")}
            </p>
            <p className="text-sm text-gray-400">{t("convert.status", { status: taskStatus })}</p>
          </div>
        )}

        {stage === "done" && (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium">{t("convert.done")}</p>
            {outputTaskType && PREVIEWABLE_TYPES[outputTaskType] && (
              <button
                onClick={handlePreview}
                className="w-full bg-blue-600 text-white rounded-md py-3 font-medium hover:bg-blue-700"
              >
                {PREVIEW_LABEL_KEYS[outputTaskType] ? t(PREVIEW_LABEL_KEYS[outputTaskType]) : t("convert.previewFile")}
              </button>
            )}
            <button
              onClick={handleDownload}
              className="w-full bg-green-600 text-white rounded-md py-3 font-medium hover:bg-green-700"
            >
              {t("convert.download")}
            </button>
            <button
              onClick={handleReset}
              className="w-full border rounded-md py-3 text-sm hover:bg-gray-50"
            >
              {t("convert.continue")}
            </button>
            <button
              onClick={handleDelete}
              className="w-full border border-red-200 text-red-500 rounded-md py-3 text-sm hover:bg-red-50"
            >
              {t("convert.deleteFile")}
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
              {t("convert.retry")}
            </button>
            {documentId && (
              <button
                onClick={handleDelete}
                className="w-full border border-red-200 text-red-500 rounded-md py-3 text-sm hover:bg-red-50"
              >
                {t("convert.deleteFile")}
              </button>
            )}
          </div>
        )}

        {!user && stage === "upload" && (
          <p className="text-center text-sm text-gray-400">
            {t("convert.guestNote")}
            <a href="/register" className="text-blue-600 hover:underline">{t("convert.guestRegister")}</a>
            {t("convert.guestSuffix")}
          </p>
        )}
      </div>
    </main>
  );
}
