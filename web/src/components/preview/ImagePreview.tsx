"use client";

import { useState, useEffect } from "react";
import { PhotoProvider, PhotoView } from "react-photo-view";
import "react-photo-view/dist/react-photo-view.css";
import { useI18n } from "@/lib/i18n";
import { fetchTaskFile } from "@/lib/fetchTaskFile";

interface ImagePreviewProps {
  taskId: string;
}

export function ImagePreview({ taskId }: ImagePreviewProps) {
  const { t } = useI18n();
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const urls: string[] = [];
    setImageUrls([]);
    setLoading(true);
    setError(false);

    async function loadImages() {
      try {
        // 获取总页数
        const pagesRes = await fetchTaskFile(taskId, { path: "/pages", json: true, signal }) as Record<string, unknown>;
        const total = pagesRes.total as number;

        // 逐页获取图片 Blob URL
        for (let i = 0; i < total; i++) {
          if (signal.aborted) return;
          const blob = await fetchTaskFile(taskId, { path: `/download/${i}`, preview: true, signal });
          if (signal.aborted) return;
          urls.push(URL.createObjectURL(blob as Blob));
        }

        if (!signal.aborted) {
          setImageUrls(urls);
          setLoading(false);
        }
      } catch {
        urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
        if (!signal.aborted) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImages();

    return () => {
      controller.abort();
      urls.splice(0).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [taskId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted text-sm">
        {t("preview.loading")}
      </div>
    );
  }

  if (error || imageUrls.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-red-500 text-sm">
        {t("preview.loadFailed")}
      </div>
    );
  }

  return (
    <PhotoProvider>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-4">
        {imageUrls.map((url, index) => (
          <PhotoView key={index} src={url}>
            <div className="relative cursor-pointer border rounded overflow-hidden hover:shadow-md transition-shadow">
              <img
                src={url}
                alt={`Page ${index + 1}`}
                className="w-full h-auto object-contain"
              />
              <span className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                {index + 1}/{imageUrls.length}
              </span>
            </div>
          </PhotoView>
        ))}
      </div>
    </PhotoProvider>
  );
}
