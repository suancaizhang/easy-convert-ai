"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ToolStage, ProgressDetail } from "@/lib/useToolPage";
import { FilePreview } from "@/components/preview";
import { useI18n } from "@/lib/i18n";
import type { TranslationKeys } from "@/i18n/types";

const STATUS_KEYS: Record<string, keyof TranslationKeys> = {
  waiting: "taskStatus.waiting", processing: "taskStatus.processing",
  success: "taskStatus.success", failed: "taskStatus.failed",
};

interface ToolPageLayoutProps {
  title: string;
  subtitle?: string;
  stage: ToolStage;
  uploadProgress: number;
  conversionProgress?: number;
  progressDetail?: ProgressDetail | null;
  taskStatus: string;
  error: string;
  taskId: string;
  taskType?: string;
  canPreview?: boolean;
  canCancel?: boolean;
  showPreview?: boolean;
  previewLabel?: string;
  downloadLabel?: string;
  convertingLabel?: string;
  progressLabel?: string;
  cancelLabel?: string;
  doneLabel?: string;
  backLabel?: string;
  uploadingLabel?: string;
  statusLabel?: string;
  retryLabel?: string;
  continueLabel?: string;
  onDownload: () => void;
  onPreview?: () => void;
  onClosePreview?: () => void;
  onReset: () => void;
  onCancel?: () => void;
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
  conversionProgress = 0,
  progressDetail,
  taskStatus,
  error,
  taskId,
  taskType,
  canPreview = false,
  canCancel = false,
  showPreview = false,
  previewLabel,
  downloadLabel,
  convertingLabel,
  progressLabel,
  cancelLabel,
  doneLabel,
  backLabel,
  uploadingLabel,
  statusLabel,
  retryLabel,
  continueLabel,
  onDownload,
  onPreview,
  onClosePreview,
  onReset,
  onCancel,
  extraActions,
  footer,
  children,
}: ToolPageLayoutProps) {
  const { t } = useI18n();
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 md:p-8 relative">
      <Link href="/" className="absolute top-4 left-4 text-sm text-muted hover:text-brand">
        {backLabel ?? t("nav.backHome")}
      </Link>

      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold font-content">{title}</h1>
          {subtitle && <p className="text-sm text-tertiary mt-1 font-content">{subtitle}</p>}
        </div>

        {error && stage !== "error" && (
          <div role="alert" className="bg-error-bg text-error-fg text-sm p-3 rounded-md">{error}</div>
        )}

        {stage === "idle" && (
          <>
            {children}
            {footer}
          </>
        )}

        {stage === "uploading" && (
          <div className="text-center space-y-2 py-4">
            <div className="animate-spin w-8 h-8 border-4 border-brand-surface border-t-brand rounded-full mx-auto" />
            <p className="text-sm text-tertiary">{uploadingLabel ?? t("convert.uploading", { progress: uploadProgress })}</p>
          </div>
        )}

        {stage === "converting" && (
          <div className="text-center space-y-4 py-8">
            <div className="animate-spin w-10 h-10 border-4 border-brand-surface border-t-brand rounded-full mx-auto" />
            <p className="text-secondary">{convertingLabel ?? t("convert.converting")}</p>

            {/* Progress bar */}
            {conversionProgress > 0 && (
              <div className="w-full max-w-md mx-auto space-y-1">
                <div className="w-full h-2 bg-brand-surface rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-300"
                    style={{ width: `${conversionProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted">
                  {progressLabel
                    ?? (progressDetail
                      ? `${progressDetail.current} / ${progressDetail.total}`
                      : `${conversionProgress}%`)}
                </p>
              </div>
            )}

            {taskStatus && !conversionProgress && (
              <p className="text-sm text-muted">{statusLabel ?? t("convert.status", { status: STATUS_KEYS[taskStatus] ? t(STATUS_KEYS[taskStatus]) : taskStatus })}</p>
            )}

            {/* Cancel button — only when task is still waiting in queue */}
            {canCancel && onCancel && (
              <button
                onClick={onCancel}
                className="text-sm text-muted hover:text-error-fg font-ui"
              >
                {cancelLabel ?? t("cancel.button")}
              </button>
            )}
          </div>
        )}

        {stage === "done" && (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 bg-success-bg rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-success-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-medium">{doneLabel ?? t("convert.done")}</p>
            {canPreview && onPreview && (
              <button
                onClick={onPreview}
                className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui"
              >
                {previewLabel ?? t("convert.previewFile")}
              </button>
            )}
            <button
              onClick={onDownload}
              className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui"
            >
              {downloadLabel ?? t("convert.download")}
            </button>
            <button
              onClick={onReset}
              className="w-full border border-border rounded-md py-3 text-sm hover:bg-page font-ui"
            >
              {continueLabel ?? t("convert.continue")}
            </button>
            {extraActions}
          </div>
        )}

        {stage === "error" && (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 bg-error-bg rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-error-fg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p role="alert" className="text-error-fg">{error}</p>
            <button
              onClick={onReset}
              className="w-full border border-border rounded-md py-3 text-sm hover:bg-page font-ui"
            >
              {retryLabel ?? t("convert.retry")}
            </button>
            {extraActions}
          </div>
        )}

        {/* 站内预览区域 */}
        {showPreview && taskId && taskType && onClosePreview && (
          <FilePreview
            taskId={taskId}
            taskType={taskType}
            open={showPreview}
            onClose={onClosePreview}
          />
        )}
      </div>
    </main>
  );
}
