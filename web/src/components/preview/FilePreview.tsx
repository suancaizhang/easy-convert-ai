"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { fetchTaskFile } from "@/lib/fetchTaskFile";
import { PreviewModal } from "./PreviewModal";
import dynamic from "next/dynamic";
import { ImagePreview } from "./ImagePreview";
import { DocxPreview } from "./DocxPreview";

// PDF.js requires browser APIs; never evaluate it during server prerendering.
const PdfPreview = dynamic(() => import("./PdfPreview").then((mod) => mod.PdfPreview), {
  ssr: false,
});

interface FilePreviewProps {
  taskId: string;
  taskType: string;
  open: boolean;
  onClose: () => void;
}

/** 根据 taskType 确定结果文件的格式类型 */
function getResultFormat(taskType: string): "pdf" | "image" | "docx" {
  const pdfTypes = [
    "word_to_pdf",
    "excel_to_pdf",
    "ppt_to_pdf",
    "images_to_pdf",
    "pdf_compress",
    "pdf_merge",
    "pdf_rotate",
    "pdf_split",
    "pdf_watermark",
  ];
  const docxTypes = ["pdf_to_word", "ocr_to_word"];

  if (pdfTypes.includes(taskType)) return "pdf";
  if (docxTypes.includes(taskType)) return "docx";
  return "image"; // pdf_to_image
}

export function FilePreview({ taskId, taskType, open, onClose }: FilePreviewProps) {
  const { t } = useI18n();
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const format = getResultFormat(taskType);

  // PDF 和 Docx 需要先加载 Blob
  useEffect(() => {
    if (!open || !taskId) return;
    if (format !== "pdf") return;

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchTaskFile(taskId, { preview: true })
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob as Blob);
        setPdfFile(url);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      if (pdfFile) {
        URL.revokeObjectURL(pdfFile);
        setPdfFile(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, taskId, format]);

  const renderContent = () => {
    if (error) {
      return (
        <div className="flex items-center justify-center py-12 text-red-500 text-sm">
          {t("preview.loadFailed")}
        </div>
      );
    }

    switch (format) {
      case "pdf":
        if (loading || !pdfFile) {
          return (
            <div className="flex items-center justify-center py-12 text-muted text-sm">
              {t("preview.loading")}
            </div>
          );
        }
        return <PdfPreview file={pdfFile} />;

      case "image":
        return <ImagePreview taskId={taskId} />;

      case "docx":
        return <DocxPreview taskId={taskId} />;
    }
  };

  return (
    <PreviewModal open={open} onClose={onClose}>
      {renderContent()}
    </PreviewModal>
  );
}
