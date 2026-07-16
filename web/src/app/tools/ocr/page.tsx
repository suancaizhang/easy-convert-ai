"use client";

import { useState, useCallback, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const MAX_SIZE = 20 * 1024 * 1024;

type OutputFormat = "docx" | "txt" | "searchable_pdf";

const OUTPUT_FORMATS: { value: OutputFormat; labelKey: "ocr.formatDocx" | "ocr.formatTxt" | "ocr.formatSearchablePdf" }[] = [
  { value: "docx", labelKey: "ocr.formatDocx" },
  { value: "txt", labelKey: "ocr.formatTxt" },
  { value: "searchable_pdf", labelKey: "ocr.formatSearchablePdf" },
];

export default function OcrPage() {
  return (
    <Suspense>
      <OcrPageInner />
    </Suspense>
  );
}

function OcrPageInner() {
  const { user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [file, setFile] = useState<File | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("docx");
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = useCallback(
    async (documentIds: string[]) => {
      const task = await api.post<{ id: string; status: string }>(
        "/api/tasks/create",
        {
          document_id: documentIds[0],
          task_type: "ocr_to_word",
          params: { output_format: outputFormat },
        }
      );
      return task.id;
    },
    [outputFormat]
  );

  const tool = useToolPage({ createTask });

  const handleFileSelect = (f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    const validExts = ["pdf", "png", "jpg", "jpeg", "webp"];
    if (!ACCEPTED_TYPES.includes(f.type) && !validExts.includes(ext)) {
      setLocalError(t("convert.unsupportedFormat"));
      return;
    }
    if (f.size > MAX_SIZE) {
      setLocalError(t("convert.fileTooLarge"));
      return;
    }
    setFile(f);
    setLocalError("");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, []);

  const handleSubmit = async () => {
    // TODO: 测试期间放开登录限制，上线前恢复
    // if (!user) {
    //   router.push("/login");
    //   return;
    // }
    if (!file) return;
    setLocalError("");
    await tool.uploadAndRun([file]);
  };

  const handleReset = () => {
    tool.reset();
    setFile(null);
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loginPrompt = null; // TODO: 测试期间隐藏登录提示，上线前恢复
  // const loginPrompt = !user ? (
  //   <p className="text-center text-sm text-amber-600 bg-amber-50 rounded-md px-3 py-2">
  //     {t("ocr.loginRequired")}
  //     <a href="/login" className="font-medium underline hover:text-amber-800">
  //       {t("ocr.loginLink")}
  //     </a>
  //   </p>
  // ) : null;

  return (
    <ToolPageLayout
      title={t("ocr.title")}
      subtitle={t("ocr.subtitle")}
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType="ocr_to_word"
      canPreview
      showPreview={tool.showPreview}
      previewLabel={t("ocr.preview")}
      downloadLabel={t("ocr.download")}
      convertingLabel={
        tool.uploadProgress < 100
          ? t("ocr.uploading", { progress: tool.uploadProgress })
          : t("ocr.converting")
      }
      doneLabel={t("ocr.done")}
      backLabel={t("nav.backHome")}
      uploadingLabel={t("ocr.uploading", { progress: tool.uploadProgress })}
      statusLabel={t("ocr.status", { status: tool.taskStatus })}
      retryLabel={t("ocr.retry")}
      continueLabel={t("ocr.continue")}
      onDownload={tool.download}
      onPreview={tool.preview}
      onClosePreview={tool.closePreview}
      onReset={handleReset}
      footer={loginPrompt}
    >
      {/* Drop zone */}
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
          accept=".pdf,.png,.jpg,.jpeg,.webp"
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
                setFile(null);
                setLocalError("");
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-gray-200 hover:bg-red-100 text-tertiary hover:text-error-fg rounded-full flex items-center justify-center text-sm"
              title={t("convert.removeFile")}
            >
              ×
            </button>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-tertiary mt-1">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        ) : (
          <div>
            <p className="text-tertiary">{t("ocr.dropzone")}</p>
            <p className="text-xs text-muted mt-2">{t("ocr.dropzoneHint")}</p>
          </div>
        )}
      </div>

      {/* Output format selector */}
      <div>
        <label className="block text-sm font-medium mb-2">{t("ocr.outputFormat")}</label>
        <div className="grid grid-cols-3 gap-2">
          {OUTPUT_FORMATS.map((fmt) => (
            <button
              key={fmt.value}
              onClick={() => setOutputFormat(fmt.value)}
              className={`px-3 py-2 rounded-md text-sm border transition-colors ${
                outputFormat === fmt.value
                  ? "border-brand bg-brand-surface text-brand"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              {t(fmt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={!file}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("ocr.startConvert")}
      </button>
    </ToolPageLayout>
  );
}
