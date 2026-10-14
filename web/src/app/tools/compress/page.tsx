"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const MAX_SIZE = 20 * 1024 * 1024;
const QUALITY_OPTIONS = [
  { value: "low", label: "pdf.compress.low" },
  { value: "medium", label: "pdf.compress.medium" },
  { value: "high", label: "pdf.compress.high" },
] as const;

export default function CompressPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState("medium");
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = useCallback(async (documentIds: string[]) => {
    const task = await api.post<{ id: string }>("/api/tasks/create", {
      document_id: documentIds[0],
      task_type: "pdf_compress",
      params: { quality },
    });
    return task.id;
  }, [quality]);

  const tool = useToolPage({ createTask });

  const handleFileSelect = (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setLocalError(t("pdf.onlyPdf"));
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
  }, [t]);

  const handleStart = async () => {
    if (!file) return;
    setLocalError("");
    await tool.uploadAndRun([file]);
  };

  const handleReset = () => {
    tool.reset();
    setFile(null);
    setQuality("medium");
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <ToolPageLayout
      title={t("taskType.pdfCompress")}
      subtitle={t("pdf.compress.subtitle")}
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      conversionProgress={tool.conversionProgress}
      progressDetail={tool.progressDetail}
      canCancel={tool.canCancel}
      onCancel={tool.cancel}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType="pdf_compress"
      canPreview
      showPreview={tool.showPreview}
      previewLabel={t("convert.previewPdf")}
      downloadLabel={t("pdf.compress.download")}
      convertingLabel={t("pdf.compress.busy")}
      doneLabel={t("pdf.compress.done")}
      onDownload={tool.download}
      onPreview={tool.preview}
      onClosePreview={tool.closePreview}
      onReset={handleReset}
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
          accept=".pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />
        {file ? (
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-tertiary mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        ) : (
          <div>
            <p className="text-tertiary">{t("pdf.dropzone")}</p>
            <p className="text-xs text-muted mt-2">{t("pdf.maxSize")}</p>
          </div>
        )}
      </div>

      {file && (
        <div>
          <label className="block text-sm font-medium mb-2">{t("pdf.compress.quality")}</label>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuality(opt.value)}
                className={`px-3 py-2 rounded-md text-sm border ${
                  quality === opt.value
                    ? "border-brand bg-brand-surface text-brand"
                    : "border-border hover:border-brand-light"
                }`}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!file}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("pdf.compress.start")}
      </button>
    </ToolPageLayout>
  );
}
