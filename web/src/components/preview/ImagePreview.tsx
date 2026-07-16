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
    let cancelled = false;

    async function loadImages() {
      try {
        // 获取总页数
        const pagesRes = await fetchTaskFile(taskId, { path: "/pages", json: true }) as Record<string, unknown>;
        const total = pagesRes.total as number;

        // 逐页获取图片 Blob URL
        const urls: string[] = [];
        for (let i = 0; i < total; i++) {
          if (cancelled) return;
          const blob = await fetchTaskFile(taskId, { path: `/download/${i}`, preview: true });
          urls.push(URL.createObjectURL(blob as Blob));
        }

        if (!cancelled) {
          setImageUrls(urls);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    loadImages();

    return () => {
      cancelled = true;
      // 释放 Blob URL
      imageUrls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
