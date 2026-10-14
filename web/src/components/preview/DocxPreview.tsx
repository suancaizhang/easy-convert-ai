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
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    setError(false);

    async function render() {
      try {
        const blob = await fetchTaskFile(taskId, { preview: true, signal }) as Blob;
        const arrayBuffer = await blob.arrayBuffer();

        if (signal.aborted) return;

        // 动态 import docx-preview 避免 SSR 问题
        const { renderAsync } = await import("docx-preview");
        if (signal.aborted) return;
        // Render off-DOM so a late library completion cannot overwrite a new task.
        const content = document.createElement("div");
        await renderAsync(arrayBuffer, content, undefined, {
          className: "docx-preview-wrapper",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
        });

        if (!signal.aborted && containerRef.current) {
          containerRef.current.replaceChildren(content);
          setLoading(false);
        }
      } catch {
        if (!signal.aborted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    render();

    return () => {
      controller.abort();
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
