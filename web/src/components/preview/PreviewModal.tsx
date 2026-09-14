"use client";

import { useEffect, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * 响应式预览容器：
 * - 移动端（<md）：全屏模态覆盖
 * - Web（≥md）：内嵌面板
 */
export function PreviewModal({ open, onClose, children }: PreviewModalProps) {
  const { t } = useI18n();

  // 移动端全屏时禁止 body 滚动
  useEffect(() => {
    if (!open) return;

    const mql = window.matchMedia("(max-width: 767px)");
    if (mql.matches) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-card flex flex-col md:static md:z-auto md:w-full md:mt-6 md:border md:rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 md:py-2 md:bg-page border-b shrink-0">
        <span className="font-medium text-sm md:text-secondary">{t("preview.title")}</span>
        <button
          onClick={onClose}
          className="text-tertiary hover:text-primary p-1 md:text-muted md:hover:text-secondary text-sm"
          aria-label={t("preview.close")}
        >
          <svg className="w-5 h-5 md:hidden" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="hidden md:inline">{t("preview.close")}</span>
        </button>
      </div>
      <div className="flex-1 min-h-0 md:max-h-[70vh] overflow-auto">{children}</div>
    </div>
  );
}
