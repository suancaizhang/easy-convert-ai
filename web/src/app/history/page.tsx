"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { downloadTaskFile } from "@/lib/fetchTaskFile";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { FilePreview } from "@/components/preview";
import type { TranslationKeys } from "@/i18n/types";

interface HistoryItem {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  file_status: string;
  created_at: string;
  task_type: string | null;
  task_status: string | null;
  task_id: string | null;
}

const TASK_TYPE_LABEL_KEYS: Record<string, keyof TranslationKeys> = {
  pdf_to_word: "taskType.pdfToWord",
  word_to_pdf: "taskType.wordToPdf",
  excel_to_pdf: "taskType.excelToPdf",
  ppt_to_pdf: "taskType.pptToPdf",
  pdf_to_image: "taskType.pdfToImage",
  images_to_pdf: "taskType.imagesToPdf",
  ocr_to_word: "taskType.ocrToWord",
  pdf_merge: "taskType.pdfMerge",
  pdf_split: "taskType.pdfSplit",
  pdf_compress: "taskType.pdfCompress",
  pdf_rotate: "taskType.pdfRotate",
  pdf_watermark: "taskType.pdfWatermark",
};

const STATUS_LABEL_KEYS: Record<string, { key: keyof TranslationKeys; className: string }> = {
  success: { key: "taskStatus.success", className: "text-success-fg bg-success-bg" },
  failed: { key: "taskStatus.failed", className: "text-error-fg bg-error-bg" },
  processing: { key: "taskStatus.processing", className: "text-brand bg-brand-surface" },
  waiting: { key: "taskStatus.waiting", className: "text-warning-fg bg-warning-bg" },
};

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [downloadError, setDownloadError] = useState("");
  const downloadRef = useRef<AbortController | null>(null);
  useEffect(() => () => downloadRef.current?.abort(), []);

  const handleDownload = async (id: string) => {
    downloadRef.current?.abort();
    const controller = new AbortController();
    downloadRef.current = controller;
    setDownloadError("");
    try {
      await downloadTaskFile(id, controller.signal);
    } catch {
      if (!controller.signal.aborted) setDownloadError(t("history.downloadFailed"));
    }
  };
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [previewTaskType, setPreviewTaskType] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm(t("history.deleteConfirm"))) return;

    try {
      await api.delete(`/api/documents/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert(t("history.deleteFailed"));
      }
    }
  };

  const handlePreview = (taskId: string, taskType: string) => {
    setPreviewTaskId(taskId);
    setPreviewTaskType(taskType);
  };

  const handleClosePreview = () => {
    setPreviewTaskId(null);
    setPreviewTaskType(null);
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setFetching(true);
    setLoadFailed(false);
    api
      .get<{ items: HistoryItem[]; total: number }>(
        `/api/documents/history?page=${page}&page_size=20`,
        { signal: controller.signal }
      )
      .then((res) => {
        if (controller.signal.aborted) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch(() => { if (!controller.signal.aborted) setLoadFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setFetching(false); });
    return () => controller.abort();
  }, [user, page, reload]);

  if (loading || !user) return null;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold font-content">{t("history.title")}</h1>
        <Link href="/convert" className="text-sm text-brand hover:underline">
          {t("history.newConvert")}
        </Link>
      </div>

      {fetching && items.length === 0 && (
        <p className="text-muted text-center py-12">{t("history.loading")}</p>
      )}

      {loadFailed && (
        <div role="alert" className="bg-error-bg text-error-fg text-center p-4 rounded-md mb-4">
          <p>{t("history.loadFailed")}</p>
          <button onClick={() => setReload((value) => value + 1)} className="underline mt-2">{t("history.retry")}</button>
        </div>
      )}
      {downloadError && <p role="alert" className="text-error-fg mb-4">{downloadError}</p>}

      {!fetching && !loadFailed && items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted mb-4">{t("history.empty")}</p>
          <Link
            href="/convert"
            className="text-brand hover:underline text-sm"
          >
            {t("history.startFirst")}
          </Link>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((item) => {
            const isExpired = item.file_status === "expired";
            return (
              <div
                key={item.id}
                className={`border border-border rounded-lg p-4 bg-card ${isExpired ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium font-content truncate">{item.filename}</p>
                    <p className="text-sm text-tertiary mt-1">
                      {item.task_type && TASK_TYPE_LABEL_KEYS[item.task_type]
                        ? t(TASK_TYPE_LABEL_KEYS[item.task_type])
                        : item.task_type || "—"}
                      {" · "}
                      {(item.file_size / 1024 / 1024).toFixed(2)} MB
                      {" · "}
                      {new Date(item.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpired && (
                      <span className="text-xs px-2 py-0.5 rounded bg-page text-muted">
                        {t("history.expired")}
                      </span>
                    )}
                    {item.task_status && STATUS_LABEL_KEYS[item.task_status] && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${STATUS_LABEL_KEYS[item.task_status].className}`}
                      >
                        {t(STATUS_LABEL_KEYS[item.task_status].key)}
                      </span>
                    )}
                    {item.task_type &&
                      item.task_id &&
                      item.task_status === "success" && (
                        <button
                          onClick={() => handlePreview(item.task_id!, item.task_type!)}
                          className="text-brand hover:text-brand-hover p-1 rounded hover:bg-brand-surface transition-colors"
                          title={t("history.preview")}
                          aria-label={t("history.preview")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                    {item.task_id && item.task_status === "success" && (
                      <button onClick={() => handleDownload(item.task_id!)}
                        className="text-brand hover:text-brand-hover p-1 text-sm"
                        aria-label={t("history.download")}>
                        {t("history.download")}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-muted hover:text-error-fg p-1 rounded hover:bg-error-bg transition-colors"
                      title={t("history.delete")}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > 20 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
          >
            {t("history.prevPage")}
          </button>
          <span className="px-3 py-1 text-sm text-tertiary">
            {t("history.pageInfo", { current: page, total: Math.ceil(total / 20) })}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1 border border-border rounded text-sm disabled:opacity-50"
          >
            {t("history.nextPage")}
          </button>
        </div>
      )}

      {/* 站内预览 */}
      {previewTaskId && previewTaskType && (
        <FilePreview
          taskId={previewTaskId}
          taskType={previewTaskType}
          open={true}
          onClose={handleClosePreview}
        />
      )}
    </main>
  );
}
