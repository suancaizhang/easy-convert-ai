"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { fetchTaskFile } from "@/lib/fetchTaskFile";
import { PreviewModal } from "./PreviewModal";
import dynamic from "next/dynamic";
import { ImagePreview } from "./ImagePreview";
import { DocxPreview } from "./DocxPreview";

// PDF.js requires browser APIs; never evaluate it during server prerendering.
const PdfPreview = dynamic(() => import("./PdfPreview").then((mod) => mod.PdfPreview), { ssr: false });

interface FilePreviewProps {
  taskId: string;
  taskType: string;
  open: boolean;
  onClose: () => void;
}

function ArtifactPreview({ taskId }: { taskId: string }) {
  const { t } = useI18n();
  const [format, setFormat] = useState("");
  const [pdfFile, setPdfFile] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl: string | undefined;
    async function load() {
      try {
        const pages = await fetchTaskFile(taskId, { path: "/pages", json: true, signal }) as Record<string, unknown>;
        if (signal.aborted) return;
        const ext = String(pages.ext).replace(/^\./, "").toLowerCase();
        if (!["pdf", "docx", "txt", "png", "jpg", "jpeg", "webp"].includes(ext)) throw new Error("Unsupported artifact format");
        if (ext === "pdf" || ext === "txt") {
          const blob = await fetchTaskFile(taskId, { preview: true, signal }) as Blob;
          if (signal.aborted) return;
          if (ext === "pdf") {
            objectUrl = URL.createObjectURL(blob);
            setPdfFile(objectUrl);
          } else {
            const content = await blob.text();
            if (signal.aborted) return;
            setText(content);
          }
        }
        setFormat(ext);
        setLoading(false);
      } catch {
        if (!signal.aborted) { setError(true); setLoading(false); }
      }
    }
    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId]);

  if (error) return <div role="alert" className="text-center py-12 text-error-fg text-sm">{t("preview.loadFailed")}</div>;
  if (loading) return <div className="text-center py-12 text-muted text-sm">{t("preview.loading")}</div>;
  if (format === "pdf" && pdfFile) return <PdfPreview file={pdfFile} />;
  if (format === "docx") return <DocxPreview taskId={taskId} />;
  if (format === "txt") return <pre className="p-4 whitespace-pre-wrap break-words text-sm">{text}</pre>;
  return <ImagePreview taskId={taskId} />;
}

export function FilePreview({ taskId, open, onClose }: FilePreviewProps) {
  return (
    <PreviewModal open={open} onClose={onClose}>
      {open && taskId && <ArtifactPreview key={taskId} taskId={taskId} />}
    </PreviewModal>
  );
}
