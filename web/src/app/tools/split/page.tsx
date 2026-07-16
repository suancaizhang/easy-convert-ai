"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const MAX_SIZE = 20 * 1024 * 1024;

export default function SplitPage() {
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
    if (!pages.trim()) {
      setLocalError("请输入页码范围");
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
      title="PDF 拆分"
      subtitle="提取 PDF 中的指定页面"
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType="pdf_split"
      canPreview
      showPreview={tool.showPreview}
      previewLabel="预览 PDF"
      downloadLabel="下载 PDF"
      convertingLabel="拆分中..."
      doneLabel="拆分完成！"
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
            <p className="text-tertiary">点击或拖拽 PDF 到此处</p>
            <p className="text-xs text-muted mt-2">最大 20MB</p>
          </div>
        )}
      </div>

      {file && (
        <div>
          <label className="block text-sm font-medium mb-2">页码范围</label>
          <input
            type="text"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            placeholder="例如：1-3,5,7-10"
            className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-muted mt-1">支持格式：1-3,5,7-10</p>
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!file || !pages.trim()}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui disabled:opacity-50 disabled:cursor-not-allowed"
      >
        开始拆分
      </button>
    </ToolPageLayout>
  );
}
