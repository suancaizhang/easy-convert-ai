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
    <>
      {/* 移动端：全屏模态 */}
      <div className="fixed inset-0 z-50 bg-card flex flex-col md:hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <span className="font-medium text-sm">{t("preview.title")}</span>
          <button
            onClick={onClose}
            className="text-tertiary hover:text-primary p-1"
            aria-label={t("preview.close")}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>

      {/* Web 端：内嵌面板 */}
      <div className="hidden md:block w-full mt-6 border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-page border-b">
          <span className="text-sm font-medium text-secondary">{t("preview.title")}</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-secondary text-sm"
          >
            {t("preview.close")}
          </button>
        </div>
        <div className="max-h-[70vh] overflow-auto">{children}</div>
      </div>
    </>
  );
}
