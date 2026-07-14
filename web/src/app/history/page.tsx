"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

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

const TASK_TYPE_LABELS: Record<string, string> = {
  pdf_to_word: "PDF → Word",
  word_to_pdf: "Word → PDF",
  excel_to_pdf: "Excel → PDF",
  ppt_to_pdf: "PPT → PDF",
  pdf_to_image: "PDF → 图片",
  images_to_pdf: "图片 → PDF",
  ocr_to_word: "OCR → Word",
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

const PREVIEW_LABELS: Record<string, string> = {
  pdf_to_image: "预览图片",
  word_to_pdf: "预览 PDF",
  excel_to_pdf: "预览 PDF",
  ppt_to_pdf: "预览 PDF",
  images_to_pdf: "预览 PDF",
};

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  success: { text: "完成", className: "text-green-600 bg-green-50" },
  failed: { text: "失败", className: "text-red-600 bg-red-50" },
  processing: { text: "处理中", className: "text-blue-600 bg-blue-50" },
  waiting: { text: "等待中", className: "text-yellow-600 bg-yellow-50" },
};

export default function HistoryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [fetching, setFetching] = useState(true);

  const handleDelete = async (id: string) => {
    if (!confirm("确定要删除此记录吗？删除后无法恢复。")) return;

    try {
      await api.delete(`/api/documents/${id}`);
      // Optimistic delete：先从列表移除
      setItems((prev) => prev.filter((item) => item.id !== id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      // 删除失败时重新加载列表
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("删除失败，请重试");
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
        if (!res.ok) throw new Error("预览失败");
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        window.open(blobUrl, "_blank");
      })
      .catch(() => alert("预览失败"));
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
        <h1 className="text-2xl font-bold">转换历史</h1>
        <Link href="/convert" className="text-sm text-blue-600 hover:underline">
          新建转换
        </Link>
      </div>

      {fetching && items.length === 0 && (
        <p className="text-gray-400 text-center py-12">加载中...</p>
      )}

      {!fetching && items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">暂无转换记录</p>
          <Link
            href="/convert"
            className="text-blue-600 hover:underline text-sm"
          >
            开始第一次转换
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
                      {item.task_type ? TASK_TYPE_LABELS[item.task_type] || item.task_type : "—"}
                      {" · "}
                      {(item.file_size / 1024 / 1024).toFixed(2)} MB
                      {" · "}
                      {new Date(item.created_at).toLocaleString("zh-CN")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpired && (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                        已过期
                      </span>
                    )}
                    {item.task_status && STATUS_LABELS[item.task_status] && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${STATUS_LABELS[item.task_status].className}`}
                      >
                        {STATUS_LABELS[item.task_status].text}
                      </span>
                    )}
                    {item.task_type &&
                      PREVIEWABLE_TYPES[item.task_type] &&
                      item.task_id &&
                      item.task_status === "success" && (
                        <button
                          onClick={() => handlePreview(item.task_id!)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                          title={PREVIEW_LABELS[item.task_type] || "预览"}
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
                      title="删除"
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
            上一页
          </button>
          <span className="px-3 py-1 text-sm text-gray-500">
            {page} / {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            下一页
          </button>
        </div>
      )}
    </main>
  );
}
