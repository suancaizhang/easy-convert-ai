"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
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
};

const PREVIEWABLE_TYPES: Record<string, boolean> = {
  pdf_to_word: false,
  pdf_to_image: true,
  word_to_pdf: true,
  excel_to_pdf: true,
  ppt_to_pdf: true,
  images_to_pdf: true,
  ocr_to_word: false,
};

const PREVIEW_LABEL_KEYS: Record<string, keyof TranslationKeys> = {
  pdf_to_image: "history.previewImage",
  word_to_pdf: "history.previewPdf",
  excel_to_pdf: "history.previewPdf",
  ppt_to_pdf: "history.previewPdf",
  images_to_pdf: "history.previewPdf",
};

const STATUS_LABEL_KEYS: Record<string, { key: keyof TranslationKeys; className: string }> = {
  success: { key: "taskStatus.success", className: "text-green-600 bg-green-50" },
  failed: { key: "taskStatus.failed", className: "text-red-600 bg-red-50" },
  processing: { key: "taskStatus.processing", className: "text-blue-600 bg-blue-50" },
  waiting: { key: "taskStatus.waiting", className: "text-yellow-600 bg-yellow-50" },
};

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);

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

  const handlePreview = (taskId: string) => {
    const token = localStorage.getItem("token");
    const url = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8111"}/api/tasks/${taskId}/download?preview=1`;
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    fetch(url, { headers })
      .then((res) => {
        if (!res.ok) throw new Error("preview failed");
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      })
      .catch(() => alert(t("history.previewFailed")));
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user) return;
    setFetching(true);
    api
      .get<{ items: HistoryItem[]; total: number }>(
        `/api/documents/history?page=${page}&page_size=20`
      )
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .finally(() => setFetching(false));
  }, [user, page]);

  if (loading || !user) return null;

  return (
    <main className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{t("history.title")}</h1>
        <Link href="/convert" className="text-sm text-blue-600 hover:underline">
          {t("history.newConvert")}
        </Link>
      </div>

      {fetching && items.length === 0 && (
        <p className="text-gray-400 text-center py-12">{t("history.loading")}</p>
      )}

      {!fetching && items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">{t("history.empty")}</p>
          <Link
            href="/convert"
            className="text-blue-600 hover:underline text-sm"
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
                className={`border rounded-lg p-4 ${isExpired ? "opacity-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{item.filename}</p>
                    <p className="text-sm text-gray-500 mt-1">
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
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
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
                      PREVIEWABLE_TYPES[item.task_type] &&
                      item.task_id &&
                      item.task_status === "success" && (
                        <button
                          onClick={() => handlePreview(item.task_id!)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                          title={PREVIEW_LABEL_KEYS[item.task_type] ? t(PREVIEW_LABEL_KEYS[item.task_type]) : t("history.preview")}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      )}
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors"
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
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            {t("history.prevPage")}
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            {t("history.pageInfo", { current: page, total: Math.ceil(total / 20) })}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            {t("history.nextPage")}
          </button>
        </div>
      )}
    </main>
  );
}
