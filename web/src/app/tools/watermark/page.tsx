"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const MAX_SIZE = 20 * 1024 * 1024;
const POSITION_OPTIONS = [
  { value: "center", label: "pdf.watermark.center" },
  { value: "top-left", label: "pdf.watermark.topLeft" },
  { value: "top-right", label: "pdf.watermark.topRight" },
  { value: "bottom-left", label: "pdf.watermark.bottomLeft" },
  { value: "bottom-right", label: "pdf.watermark.bottomRight" },
] as const;

export default function WatermarkPage() {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [opacity, setOpacity] = useState(0.3);
  const [position, setPosition] = useState("center");
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = useCallback(async (documentIds: string[]) => {
    const task = await api.post<{ id: string }>("/api/tasks/create", {
      document_id: documentIds[0],
      task_type: "pdf_watermark",
      params: { text, opacity, position },
    });
    return task.id;
  }, [text, opacity, position]);

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
    if (!text.trim()) {
      setLocalError(t("pdf.watermark.textRequired"));
      return;
    }
    setLocalError("");
    await tool.uploadAndRun([file]);
  };

  const handleReset = () => {
    tool.reset();
    setFile(null);
    setText("");
    setOpacity(0.3);
    setPosition("center");
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <ToolPageLayout
      title={t("taskType.pdfWatermark")}
      subtitle={t("pdf.watermark.subtitle")}
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      conversionProgress={tool.conversionProgress}
      progressDetail={tool.progressDetail}
      canCancel={tool.canCancel}
      onCancel={tool.cancel}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType="pdf_watermark"
      canPreview
      showPreview={tool.showPreview}
      previewLabel={t("convert.previewPdf")}
      downloadLabel={t("imagesToPdf.downloadPdf")}
      convertingLabel={t("pdf.watermark.busy")}
      doneLabel={t("pdf.watermark.done")}
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
        <>
          <div>
            <label className="block text-sm font-medium mb-2">{t("pdf.watermark.text")}</label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("pdf.watermark.placeholder")}
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t("pdf.watermark.opacity", { value: Math.round(opacity * 100) })}</label>
            <input
              type="range"
              min="5"
              max="100"
              value={Math.round(opacity * 100)}
              onChange={(e) => setOpacity(Number(e.target.value) / 100)}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">{t("pdf.watermark.position")}</label>
            <div className="grid grid-cols-3 gap-2">
              {POSITION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPosition(opt.value)}
                  className={`px-3 py-2 rounded-md text-sm border ${
                    position === opt.value
                      ? "border-brand bg-brand-surface text-brand"
                      : "border-border hover:border-brand-light"
                  }`}
                >
                  {t(opt.label)}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <button
        onClick={handleStart}
        disabled={!file || !text.trim()}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("pdf.watermark.start")}
      </button>
    </ToolPageLayout>
  );
}
