"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useI18n } from "@/lib/i18n";

// Bundle the matching worker on this origin; cross-origin workers require an
// unreleased PDF.js wrapper Blob. React-PDF recommends this import form:
// https://github.com/wojtekmaj/react-pdf/tree/v9.2.1#configure-pdfjs-worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface PdfPreviewProps {
  /** PDF 文件的 Blob URL 或 ArrayBuffer */
  file: string | ArrayBuffer;
}

export function PdfPreview({ file }: PdfPreviewProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // 监听容器宽度变化，实现自适应
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // 减去 padding (p-4 = 32px)
        setContainerWidth(entry.contentRect.width - 32);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setError(true);
    setLoading(false);
  }, []);

  const prevPage = () => setPageNumber((p) => Math.max(1, p - 1));
  const nextPage = () => setPageNumber((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.5, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));

  if (error) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500 text-sm">
        {t("preview.loadFailed")}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* 工具栏 */}
      <div className="flex items-center gap-2 py-2 px-4 border-b w-full justify-center bg-page sticky top-0 z-10">
        <button
          onClick={prevPage}
          disabled={pageNumber <= 1}
          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
        >
          ‹
        </button>
        <span className="text-sm text-secondary min-w-[80px] text-center">
          {t("preview.page", { current: pageNumber, total: numPages })}
        </span>
        <button
          onClick={nextPage}
          disabled={pageNumber >= numPages}
          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
        >
          ›
        </button>
        <span className="mx-2 text-gray-300">|</span>
        <button
          onClick={zoomOut}
          disabled={scale <= 0.5}
          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
          title={t("preview.zoomOut")}
        >
          −
        </button>
        <span className="text-sm text-tertiary min-w-[40px] text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={zoomIn}
          disabled={scale >= 2.5}
          className="px-2 py-1 text-sm border rounded disabled:opacity-40 hover:bg-gray-100"
          title={t("preview.zoomIn")}
        >
          +
        </button>
      </div>

      {/* PDF 渲染区域 */}
      <div ref={containerRef} className="overflow-auto w-full flex justify-center p-4">
        {loading && (
          <div className="py-12 text-muted text-sm">{t("preview.loading")}</div>
        )}
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading=""
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            width={containerWidth}
            className="shadow-lg"
          />
        </Document>
      </div>
    </div>
  );
}
