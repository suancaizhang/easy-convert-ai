"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ToolStage } from "@/lib/useToolPage";

interface ToolPageLayoutProps {
  title: string;
  subtitle?: string;
  stage: ToolStage;
  uploadProgress: number;
  taskStatus: string;
  error: string;
  taskId: string;
  canPreview?: boolean;
  previewLabel?: string;
  downloadLabel?: string;
  convertingLabel?: string;
  doneLabel?: string;
  backLabel?: string;
  uploadingLabel?: string;
  statusLabel?: string;
  retryLabel?: string;
  continueLabel?: string;
  onDownload: () => void;
  onPreview?: () => void;
  onReset: () => void;
  /** Extra actions in the done/error stage (e.g. delete button) */
  extraActions?: ReactNode;
  /** Footer content shown in idle stage below children (e.g. guest note) */
  footer?: ReactNode;
  /** Upload zone + params rendered in idle stage */
  children: ReactNode;
}

export function ToolPageLayout({
  title,
  subtitle,
  stage,
  uploadProgress,
  taskStatus,
  error,
  taskId,
  canPreview = false,
  previewLabel = "预览",
  downloadLabel = "下载",
  convertingLabel = "处理中...",
  doneLabel = "处理完成",
  backLabel = "返回首页",
  uploadingLabel,
  statusLabel,
  retryLabel = "重试",
  continueLabel = "继续处理",
  onDownload,
  onPreview,
  onReset,
  extraActions,
  footer,
  children,
}: ToolPageLayoutProps) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative">
      <Link href="/" className="absolute top-4 left-4 text-sm text-gray-400 hover:text-blue-600">
        {backLabel}
      </Link>

      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>

        {stage === "idle" && (
          <>
            {children}
            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md">{error}</div>
            )}
            {footer}
          </>
        )}

        {stage === "uploading" && (
          <div className="text-center space-y-2 py-4">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto" />
            <p className="text-sm text-gray-500">{uploadingLabel ?? `上传中 ${uploadProgress}%`}</p>
          </div>
        )}

        {stage === "converting" && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto" />
            <p className="text-gray-600">{convertingLabel}</p>
            {taskStatus && (
              <p className="text-sm text-gray-400">{statusLabel ?? `状态：${taskStatus}`}</p>
            )}
          </div>
        )}

        {stage === "done" && (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium">{doneLabel}</p>
            {canPreview && onPreview && (
              <button
                onClick={onPreview}
                className="w-full bg-blue-600 text-white rounded-md py-3 font-medium hover:bg-blue-700"
              >
                {previewLabel}
              </button>
            )}
            <button
              onClick={onDownload}
              className="w-full bg-green-600 text-white rounded-md py-3 font-medium hover:bg-green-700"
            >
              {downloadLabel}
            </button>
            <button
              onClick={onReset}
              className="w-full border rounded-md py-3 text-sm hover:bg-gray-50"
            >
              {continueLabel}
            </button>
            {extraActions}
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
              onClick={onReset}
              className="w-full border rounded-md py-3 text-sm hover:bg-gray-50"
            >
              {retryLabel}
            </button>
            {extraActions}
          </div>
        )}
      </div>
    </main>
  );
}
