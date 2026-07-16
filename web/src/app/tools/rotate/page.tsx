"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";

const MAX_SIZE = 20 * 1024 * 1024;
const ANGLE_OPTIONS = [
  { value: 90, label: "顺时针 90°" },
  { value: 180, label: "旋转 180°" },
  { value: 270, label: "逆时针 90°" },
];

export default function RotatePage() {
  const [file, setFile] = useState<File | null>(null);
  const [angle, setAngle] = useState(90);
  const [pages, setPages] = useState("all");
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createTask = useCallback(async (documentIds: string[]) => {
    const task = await api.post<{ id: string }>("/api/tasks/create", {
      document_id: documentIds[0],
      task_type: "pdf_rotate",
      params: { angle, pages },
    });
    return task.id;
  }, [angle, pages]);

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
    setAngle(90);
    setPages("all");
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <ToolPageLayout
      title="PDF 旋转"
      subtitle="旋转 PDF 页面方向"
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType="pdf_rotate"
      canPreview
      showPreview={tool.showPreview}
      previewLabel="预览 PDF"
      downloadLabel="下载 PDF"
      convertingLabel="旋转中..."
      doneLabel="旋转完成！"
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
        <>
          <div>
            <label className="block text-sm font-medium mb-2">旋转角度</label>
            <div className="grid grid-cols-3 gap-2">
              {ANGLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAngle(opt.value)}
                  className={`px-3 py-2 rounded-md text-sm border ${
                    angle === opt.value
                      ? "border-brand bg-brand-surface text-brand"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">应用范围</label>
            <input
              type="text"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="all 或 1-3,5,7"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-muted mt-1">输入 all 表示全部页面，或指定页码如 1-3,5</p>
          </div>
        </>
      )}

      <button
        onClick={handleStart}
        disabled={!file}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui disabled:opacity-50 disabled:cursor-not-allowed"
      >
        开始旋转
      </button>
    </ToolPageLayout>
  );
}
