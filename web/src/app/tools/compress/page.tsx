"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const MAX_SIZE = 20 * 1024 * 1024;
const QUALITY_OPTIONS = [
  { value: "low", label: "低质量（文件最小）" },
  { value: "medium", label: "中等质量" },
  { value: "high", label: "高质量（文件较大）" },
];

export default function CompressPage() {
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
      setLocalError("仅支持 PDF 格式");
      return;
    }
    if (f.size > MAX_SIZE) {
      setLocalError("文件超过 20MB 限制");
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
      title="PDF 压缩"
      subtitle="压缩 PDF 文件大小"
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      canPreview
      previewLabel="预览 PDF"
      downloadLabel="下载压缩后的 PDF"
      convertingLabel="压缩中..."
      doneLabel="压缩完成！"
      onDownload={tool.download}
      onPreview={tool.preview}
      onReset={handleReset}
    >
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
          accept=".pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />
        {file ? (
          <div>
            <p className="font-medium">{file.name}</p>
            <p className="text-sm text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-500">点击或拖拽 PDF 到此处</p>
            <p className="text-xs text-gray-400 mt-2">最大 20MB</p>
          </div>
        )}
      </div>

      {file && (
        <div>
          <label className="block text-sm font-medium mb-2">压缩质量</label>
          <div className="grid grid-cols-3 gap-2">
            {QUALITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setQuality(opt.value)}
                className={`px-3 py-2 rounded-md text-sm border ${
                  quality === opt.value
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

      <button
        onClick={handleStart}
        disabled={!file}
        className="w-full bg-blue-600 text-white rounded-md py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        开始压缩
      </button>
    </ToolPageLayout>
  );
}
