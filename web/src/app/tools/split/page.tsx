"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const MAX_SIZE = 20 * 1024 * 1024;

export default function SplitPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState("");
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = useCallback(async (documentIds: string[]) => {
    const task = await api.post<{ id: string }>("/api/tasks/create", {
      document_id: documentIds[0],
      task_type: "pdf_split",
      params: { pages },
    });
    return task.id;
  }, [pages]);

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
    if (!pages.trim()) {
      setLocalError(t("pdf.split.pagesRequired"));
      return;
    }
    setLocalError("");
    await tool.uploadAndRun([file]);
  };

  const handleReset = () => {
    tool.reset();
    setFile(null);
    setPages("");
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <ToolPageLayout
      title={t("taskType.pdfSplit")}
      subtitle={t("pdf.split.subtitle")}
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      conversionProgress={tool.conversionProgress}
      progressDetail={tool.progressDetail}
      canCancel={tool.canCancel}
      onCancel={tool.cancel}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType="pdf_split"
      canPreview
      showPreview={tool.showPreview}
      previewLabel={t("convert.previewPdf")}
      downloadLabel={t("imagesToPdf.downloadPdf")}
      convertingLabel={t("pdf.split.busy")}
      doneLabel={t("pdf.split.done")}
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
          <label className="block text-sm font-medium mb-2">{t("pdf.split.pages")}</label>
          <input
            type="text"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder={t("pdf.split.placeholder")}
            className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-muted mt-1">{t("pdf.split.hint")}</p>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!file || !pages.trim()}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("pdf.split.start")}
      </button>
    </ToolPageLayout>
  );
}
