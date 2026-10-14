"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { api } from "@/lib/api";
import { useToolPage } from "@/lib/useToolPage";
import { ToolPageLayout } from "@/components/ToolPageLayout";
import { useI18n } from "@/lib/i18n";

const MAX_FILES = 20;
const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTS = ["png", "jpg", "jpeg", "webp"];

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

function SortableImageCard({
  item,
  index,
  onRemove,
}: {
  item: ImageItem;
  index: number;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group rounded-lg border border-border bg-card overflow-hidden aspect-square"
    >
      {/* Drag handle - whole card */}
      <div {...attributes} {...listeners} className="absolute inset-0 cursor-grab active:cursor-grabbing z-10" />

      {/* Thumbnail */}
      <img
        src={item.preview}
        alt={item.file.name}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {/* Index badge */}
      <span className="absolute top-1 left-1 bg-black/60 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center z-20">
        {index + 1}
      </span>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(item.id);
        }}
        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-600"
      >
        ×
      </button>

      {/* File name */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs px-1.5 py-0.5 truncate z-20">
        {item.file.name}
      </div>
    </div>
  );
}

export default function ImagesToPdfPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<ImageItem[]>([]);
  const [localError, setLocalError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Set<string>());

  const releasePreview = useCallback((url: string) => {
    if (previewUrls.current.delete(url)) URL.revokeObjectURL(url);
  }, []);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const createTask = useCallback(async (documentIds: string[]) => {
    const task = await api.post<{ id: string }>("/api/tasks/create-merge", {
      document_ids: documentIds,
      task_type: "images_to_pdf",
    });
    return task.id;
  }, []);

  const tool = useToolPage({ createTask });

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const incoming = Array.from(newFiles);
    const valid: ImageItem[] = [];

    for (const f of incoming) {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTS.includes(ext)) {
        setLocalError(t("imagesToPdf.unsupportedFormat"));
        continue;
      }
      if (f.size > MAX_SIZE) {
        setLocalError(t("imagesToPdf.fileTooLarge").replace("{name}", f.name));
        continue;
      }
      const preview = URL.createObjectURL(f);
      previewUrls.current.add(preview);
      valid.push({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        preview,
      });
    }

    setItems((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        setLocalError(t("imagesToPdf.maxExceeded").replace("{max}", String(MAX_FILES)));
        combined.slice(MAX_FILES).forEach((item) => releasePreview(item.preview));
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }, [t, releasePreview]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item) releasePreview(item.preview);
      return prev.filter((i) => i.id !== id);
    });
    setLocalError("");
  }, [releasePreview]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.id === active.id);
        const newIndex = prev.findIndex((i) => i.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  const handleStart = async () => {
    if (items.length < 2) {
      setLocalError(t("imagesToPdf.needAtLeast2"));
      return;
    }
    setLocalError("");
    await tool.uploadAndRun(items.map((i) => i.file));
  };

  const handleReset = () => {
    tool.reset();
    items.forEach((i) => releasePreview(i.preview));
    setItems([]);
    setLocalError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  return (
    <ToolPageLayout
      title={t("imagesToPdf.title")}
      subtitle={t("imagesToPdf.subtitle")}
      stage={tool.stage}
      uploadProgress={tool.uploadProgress}
      conversionProgress={tool.conversionProgress}
      progressDetail={tool.progressDetail}
      canCancel={tool.canCancel}
      onCancel={tool.cancel}
      taskStatus={tool.taskStatus}
      error={localError || tool.error}
      taskId={tool.taskId}
      taskType="images_to_pdf"
      canPreview
      showPreview={tool.showPreview}
      previewLabel={t("imagesToPdf.previewPdf")}
      downloadLabel={t("imagesToPdf.downloadPdf")}
      convertingLabel={t("imagesToPdf.merging")}
      doneLabel={t("imagesToPdf.done")}
      continueLabel={t("imagesToPdf.continue")}
      retryLabel={t("imagesToPdf.retry")}
      onDownload={tool.download}
      onPreview={tool.preview}
      onClosePreview={tool.closePreview}
      onReset={handleReset}
    >
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-brand-light transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".png,.jpg,.jpeg,.webp"
          multiple
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-tertiary">{t("imagesToPdf.dropzone")}</p>
        <p className="text-xs text-muted mt-2">{t("imagesToPdf.dropzoneHint")}</p>
      </div>

      {/* Image grid with dnd */}
      {items.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {t("imagesToPdf.selected").replace("{count}", String(items.length))}
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={itemIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {items.map((item, index) => (
                  <SortableImageCard
                    key={item.id}
                    item={item}
                    index={index}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Start button */}
      <button
        onClick={handleStart}
        disabled={items.length < 2}
        className="w-full bg-brand text-on-brand rounded-md py-3 font-medium hover:bg-brand-hover font-ui disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("imagesToPdf.startMerge").replace("{count}", String(items.length))}
      </button>
    </ToolPageLayout>
  );
}
