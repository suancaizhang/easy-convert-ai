"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";
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
  pdf_to_word: true,
  pdf_to_image: true,
  word_to_pdf: true,
  excel_to_pdf: true,
  ppt_to_pdf: true,
  images_to_pdf: true,
  ocr_to_word: true,
};

const PREVIEW_LABEL_KEYS: Record<string, keyof TranslationKeys> = {
  pdf_to_image: "convert.previewImage",
  word_to_pdf: "convert.previewPdf",
  excel_to_pdf: "convert.previewPdf",
  ppt_to_pdf: "convert.previewPdf",
  images_to_pdf: "convert.previewPdf",
  pdf_to_word: "convert.previewDocx",
  ocr_to_word: "convert.previewDocx",
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
  const { user, loading } = useAuth();
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();

  const presetTaskType = (() => {
    const param = searchParams.get("taskType");
    if (param && (VALID_TASK_TYPES as readonly string[]).includes(param)) {
      return param;
    }
    return null;
  })();

  const [file, setFile] = useState<File | null>(null);
  const [taskType, setTaskType] = useState(presetTaskType || "");
  const [localError, setLocalError] = useState("");
  const [documentId, setDocumentId] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = useCallback(async (documentIds: string[]) => {
    setDocumentId(documentIds[0]);
    const task = await api.post<{ id: string; status: string }>(
      "/api/tasks/create",
      { document_id: documentIds[0], task_type: taskType }
    );
    return task.id;
  }, [taskType]);

  const tool = useToolPage({ createTask });

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
      setLocalError(t("convert.unsupportedFormat"));
      return;
    }
    if (f.size > MAX_SIZE) {
      setLocalError(t("convert.fileTooLarge"));
      return;
    }

    const ext = getFileExt(f);

    if (presetTaskType) {
      const allowedExts = TASK_TO_ACCEPT_EXT[presetTaskType] || [];
      if (!allowedExts.includes(ext)) {
        setLocalError(t("convert.formatMismatch", { formats: allowedExts.map(e => `.${e}`).join("、") }));
        return;
      }
    }

    setFile(f);
    setLocalError("");

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
  }, [presetTaskType, t]);

  const handleUploadAndConvert = async () => {
    if (!file || !taskType || loading) return;
    if (taskType === "ocr_to_word" && !user) {
      router.push("/login");
      return;
    }
    setLocalError("");
    await tool.uploadAndRun([file]);
  };

  const handleReset = () => {
    tool.reset();
    setFile(null);
    setTaskType(presetTaskType || "");
    setLocalError("");
    setDocumentId("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!documentId) return;
    if (!confirm(t("convert.deleteConfirm"))) return;

    try {
      await api.delete(`/api/documents/${documentId}`);
      handleReset();
    } catch (err) {
      if (err instanceof ApiError) {
        setLocalError(err.message);
      } else {
        setLocalError(t("convert.deleteFailed"));
      }
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (!presetTaskType) {
      setTaskType("");
    }
    setLocalError("");
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

  const canPreview = !!(taskType && PREVIEWABLE_TYPES[taskType]);
  const previewLabel = taskType && PREVIEW_LABEL_KEYS[taskType]
    ? t(PREVIEW_LABEL_KEYS[taskType])
    : t("convert.previewFile");

  const deleteButton = documentId ? (
    <button
      onClick={handleDelete}
      className="w-full border border-error-bg text-error-fg rounded-md py-3 text-sm hover:bg-error-bg"
    >
      {t("convert.deleteFile")}
    </button>
  ) : null;

  const guestFooter = !user ? (
    <p className="text-center text-sm text-muted">
      {t("convert.guestNote")}
      <a href="/register" className="text-brand hover:underline">{t("convert.guestRegister")}</a>
      {t("convert.guestSuffix")}
    </p>
  ) : null;

  return (
    <ToolPageLayout
      title={pageTitle}
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      conversionProgress={tool.conversionProgress}
      progressDetail={tool.progressDetail}
      canCancel={tool.canCancel}
      onCancel={tool.cancel}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType={taskType}
      canPreview={canPreview}
      showPreview={tool.showPreview}
      previewLabel={previewLabel}
      downloadLabel={t("convert.download")}
      convertingLabel={tool.uploadProgress < 100 ? t("convert.uploading", { progress: tool.uploadProgress }) : t("convert.converting")}
      doneLabel={t("convert.done")}
      backLabel={t("nav.backHome")}
      uploadingLabel={t("convert.uploading", { progress: tool.uploadProgress })}
      retryLabel={t("convert.retry")}
      continueLabel={t("convert.continue")}
      onDownload={tool.download}
      onPreview={tool.preview}
      onClosePreview={tool.closePreview}
      onReset={handleReset}
      extraActions={deleteButton}
      footer={guestFooter}
    >
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-brand-light transition-colors"
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
              className="absolute -top-2 -right-2 w-6 h-6 bg-page hover:bg-error-bg text-muted hover:text-error-fg rounded-full flex items-center justify-center text-sm"
              title={t("convert.removeFile")}
            >
              ×
            </button>
            <p className="font-medium font-content">{file.name}</p>
            <p className="text-sm text-tertiary mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-tertiary">{t("convert.dropzone")}</p>
            <p className="text-xs text-muted mt-2">
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
                    ? "border-brand bg-brand-surface text-brand"
                    : "border-border hover:border-brand-light"
                }`}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
      )}

      {file && !presetTaskType && options.length === 1 && (
        <div className="flex items-center gap-2 text-sm text-secondary bg-page rounded-md px-3 py-2">
          <svg className="w-4 h-4 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{t("convert.conversionType")}<span className="font-medium text-primary">{t(options[0].labelKey)}</span></span>
        </div>
      )}

      {!loading && !user && taskType === "ocr_to_word" && (
        <p className="text-center text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
          {t("ocr.loginRequired")}
          <a href="/login" className="font-medium underline hover:text-amber-800">
            {t("ocr.loginLink")}
          </a>
        </p>
      )}

      <button
        onClick={handleUploadAndConvert}
        disabled={!file || !taskType || loading}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed font-ui"
      >
        {t("convert.startConvert")}
      </button>
    </ToolPageLayout>
  );
}
