"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { fetchTaskFile } from "@/lib/fetchTaskFile";

interface DocxPreviewProps {
  taskId: string;
}

export function DocxPreview({ taskId }: DocxPreviewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const blob = await fetchTaskFile(taskId, { preview: true }) as Blob;
        const arrayBuffer = await blob.arrayBuffer();

        if (cancelled || !containerRef.current) return;

        // 动态 import docx-preview 避免 SSR 问题
        const { renderAsync } = await import("docx-preview");
        await renderAsync(arrayBuffer, containerRef.current, undefined, {
          className: "docx-preview-wrapper",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });

        if (!cancelled) setLoading(false);
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    render();

    return () => {
      cancelled = true;
    };
  }, [taskId]);

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500 text-sm">
        {t("preview.loadFailed")}
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className="flex items-center justify-center py-12 text-muted text-sm">
          {t("preview.loading")}
        </div>
      )}
      <div
        ref={containerRef}
        className="docx-container p-4 overflow-auto"
        style={{ minHeight: loading ? 0 : 200 }}
      />
    </div>
  );
}
