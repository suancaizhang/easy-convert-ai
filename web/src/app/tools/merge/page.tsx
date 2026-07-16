"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const MAX_FILES = 20;
const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export default function MergePage() {
  const [files, setFiles] = useState<File[]>([]);
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = useCallback(async (documentIds: string[]) => {
    const task = await api.post<{ id: string }>("/api/tasks/create", {
      document_id: documentIds[0],
      task_type: "pdf_merge",
      source_document_ids: documentIds,
    });
    return task.id;
  }, []);

  const tool = useToolPage({ createTask });

  const addFiles = (newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    const valid: File[] = [];

    for (const f of incoming) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_TYPES.includes(f.type) && !["pdf", "png", "jpg", "jpeg", "webp"].includes(ext)) {
        setLocalError("仅支持 PDF、PNG、JPG、WebP 格式");
        continue;
      }
      if (f.size > MAX_SIZE) {
        setLocalError(`${f.name} 超过 20MB 限制`);
        continue;
      }
      valid.push(f);
    }

    setFiles((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        setLocalError(`最多 ${MAX_FILES} 个文件`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, []);

  const handleRemove = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setLocalError("");
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setFiles((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const handleStart = async () => {
    if (files.length < 2) {
      setLocalError("至少需要 2 个文件");
      return;
    }
    setLocalError("");
    await tool.uploadAndRun(files);
  };

  const handleReset = () => {
    tool.reset();
    setFiles([]);
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <ToolPageLayout
      title="PDF 合并"
      subtitle="合并多个 PDF 和图片为一个 PDF，可拖拽调整顺序"
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      canPreview
      previewLabel="预览 PDF"
      downloadLabel="下载 PDF"
      convertingLabel="合并中，请稍候..."
      doneLabel="合并完成！"
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
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-gray-500">点击或拖拽文件到此处</p>
        <p className="text-xs text-gray-400 mt-2">PDF、PNG、JPG、WebP，每个最大 20MB，最多 {MAX_FILES} 个</p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">已选 {files.length} 个文件（拖拽排序）</p>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-2 p-2 bg-gray-50 rounded-md text-sm">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleMoveUp(i); }}
                disabled={i === 0}
                className="text-gray-400 hover:text-blue-500 disabled:opacity-30"
              >
                ↑
              </button>
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-gray-400 text-xs">{(f.size / 1024 / 1024).toFixed(1)}MB</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRemove(i); }}
                className="text-gray-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={files.length < 2}
        className="w-full bg-blue-600 text-white rounded-md py-3 font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        开始合并（{files.length} 个文件）
      </button>
    </ToolPageLayout>
  );
}
