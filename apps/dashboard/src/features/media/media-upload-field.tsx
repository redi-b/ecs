"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AwsS3 from "@uppy/aws-s3";
import Uppy, { type UppyFile } from "@uppy/core";
import { useEffect, useRef, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { MediaLibraryDialog } from "./media-library-dialog";
import { MediaPreviewLightbox } from "./media-lightbox";
import { createMediaUploadId } from "./media-upload-id";
import { MediaUrlImportField } from "./media-url-import-field";

const acceptedTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const maxByteSize = 15 * 1024 * 1024;

type PendingUpload = {
  error: string | null;
  file: File;
  id: string;
  previewUrl: string;
  progress: number;
  status: "uploading" | "processing" | "failed";
};

type MediaUploadMeta = { assetId?: string };

export function MediaUploadField({
  imageUrls,
  onImageUrlsChange,
  onThumbnailChange,
  thumbnail,
}: {
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  onThumbnailChange: (url: string) => void;
  thumbnail: string;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const imageUrlsRef = useRef(imageUrls);
  const thumbnailRef = useRef(thumbnail);
  const [dragActive, setDragActive] = useState(false);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [uppy] = useState(() =>
    new Uppy<MediaUploadMeta, Record<string, never>>({
      autoProceed: true,
      restrictions: {
        allowedFileTypes: [...acceptedTypes],
        maxFileSize: maxByteSize,
      },
    }).use(AwsS3, {
      async getUploadParameters(file) {
        const createResponse = await fetch("/admin/media/uploads", {
          body: JSON.stringify({
            byteSize: file.size,
            filename: file.name,
            mimeType: file.type,
          }),
          headers: { accept: "application/json", "content-type": "application/json" },
          method: "POST",
        });
        const descriptor = (await createResponse.json().catch(() => null)) as {
          asset?: { id?: string };
          headers?: Record<string, string>;
          uploadUrl?: string;
        } | null;
        const assetId = descriptor?.asset?.id;
        if (!createResponse.ok || !descriptor?.uploadUrl || !assetId) {
          throw new Error("create_failed");
        }

        uppy.setFileMeta(file.id, { assetId });
        return {
          headers: descriptor.headers ?? {},
          method: "PUT" as const,
          url: descriptor.uploadUrl,
        };
      },
      shouldUseMultipart: false,
    }),
  );

  useEffect(() => {
    imageUrlsRef.current = imageUrls;
  }, [imageUrls]);

  useEffect(() => {
    thumbnailRef.current = thumbnail;
  }, [thumbnail]);

  function addUrls(urls: string[]) {
    const nextUrls = Array.from(new Set([...imageUrlsRef.current, ...urls.filter(Boolean)]));
    imageUrlsRef.current = nextUrls;
    onImageUrlsChange(nextUrls);
    if (!thumbnailRef.current && nextUrls[0]) {
      thumbnailRef.current = nextUrls[0];
      onThumbnailChange(nextUrls[0]);
    }
  }

  function updatePending(id: string, values: Partial<PendingUpload>) {
    setPending((current) =>
      current.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }

  function removePending(id: string) {
    if (uppy.getFile(id)) {
      try {
        uppy.removeFile(id);
      } catch {
        // File may already be gone after a successful upload cleanup.
      }
    }
    setPending((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
  }

  async function completeUpload(file: UppyFile<MediaUploadMeta, Record<string, never>>) {
    const fileId = file.id;
    const assetId = file.meta.assetId;
    const sourceFile = file.data as File;
    if (!assetId) {
      updatePending(fileId, { error: t("media.uploadError"), status: "failed" });
      return;
    }
    updatePending(fileId, { progress: 100, status: "processing" });
    try {
      const dimensions = await getImageDimensions(sourceFile);
      const completeResponse = await fetch(
        `/admin/media/uploads/${encodeURIComponent(assetId)}/complete`,
        {
          body: JSON.stringify({
            altText: filenameToAltText(sourceFile.name),
            ...dimensions,
          }),
          headers: { accept: "application/json", "content-type": "application/json" },
          method: "POST",
        },
      );
      const completed = (await completeResponse.json().catch(() => null)) as {
        asset?: { publicUrl?: string | null };
      } | null;
      const publicUrl = completed?.asset?.publicUrl;

      if (!completeResponse.ok || !publicUrl) {
        throw new Error(publicUrl === null ? "empty_url" : "complete_failed");
      }

      addUrls([publicUrl]);
      // Drop the pending tile after the ready image is in the gallery.
      removePending(fileId);
    } catch (error) {
      updatePending(fileId, {
        error:
          error instanceof Error && error.message === "empty_url"
            ? t("media.emptyUrl")
            : t("media.uploadError"),
        status: "failed",
      });
    }
  }

  // Keep latest handlers for Uppy listeners without re-binding every render.
  const completeUploadRef = useRef(completeUpload);
  const updatePendingRef = useRef(updatePending);
  completeUploadRef.current = completeUpload;
  updatePendingRef.current = updatePending;

  useEffect(() => {
    const onProgress = (
      file: { id: string } | undefined,
      progress: { bytesTotal: number | null; bytesUploaded: number },
    ) => {
      if (!file || !progress.bytesTotal) return;
      updatePendingRef.current(file.id, {
        progress: Math.round((progress.bytesUploaded / progress.bytesTotal) * 100),
      });
    };
    const onError = (file: { id: string } | undefined) => {
      if (file) {
        updatePendingRef.current(file.id, {
          error: t("media.uploadError"),
          status: "failed",
        });
      }
    };
    const onSuccess = (file: UppyFile<MediaUploadMeta, Record<string, never>> | undefined) => {
      if (file) void completeUploadRef.current(file);
    };

    uppy.on("upload-progress", onProgress);
    uppy.on("upload-error", onError);
    uppy.on("upload-success", onSuccess);
    return () => {
      uppy.off("upload-progress", onProgress);
      uppy.off("upload-error", onError);
      uppy.off("upload-success", onSuccess);
      uppy.cancelAll();
    };
  }, [t, uppy]);

  function queueFiles(files: File[]) {
    for (const file of files) {
      const validationError = validateFile(file, t);
      const previewUrl = URL.createObjectURL(file);

      if (validationError) {
        setPending((current) => [
          ...current,
          {
            error: validationError,
            file,
            id: createMediaUploadId(),
            previewUrl,
            progress: 0,
            status: "failed",
          },
        ]);
        continue;
      }

      try {
        // Uppy ignores custom ids and generates its own from file metadata.
        // Pending state must use that id or completed uploads never clear.
        const uppyFileId = uppy.addFile({
          data: file,
          name: file.name,
          type: file.type,
        });
        setPending((current) => [
          ...current,
          {
            error: null,
            file,
            id: uppyFileId,
            previewUrl,
            progress: 0,
            status: "uploading",
          },
        ]);
      } catch {
        URL.revokeObjectURL(previewUrl);
        setPending((current) => [
          ...current,
          {
            error: t("media.uploadError"),
            file,
            id: createMediaUploadId(),
            previewUrl: URL.createObjectURL(file),
            progress: 0,
            status: "failed",
          },
        ]);
      }
    }
  }

  function retryUpload(upload: PendingUpload) {
    updatePending(upload.id, { error: null, progress: 0, status: "uploading" });
    void uppy.retryUpload(upload.id);
  }

  function removeUploaded(url: string) {
    const nextUrls = imageUrlsRef.current.filter((item) => item !== url);
    imageUrlsRef.current = nextUrls;
    onImageUrlsChange(nextUrls);
    if (thumbnailRef.current === url) {
      thumbnailRef.current = nextUrls[0] ?? "";
      onThumbnailChange(thumbnailRef.current);
    }
  }

  function reorderUploaded(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const from = imageUrlsRef.current.indexOf(String(event.active.id));
    const to = imageUrlsRef.current.indexOf(String(event.over.id));
    if (from < 0 || to < 0) return;
    const nextUrls = arrayMove(imageUrlsRef.current, from, to);
    imageUrlsRef.current = nextUrls;
    onImageUrlsChange(nextUrls);
  }

  const hasImages = imageUrls.length > 0 || pending.length > 0;
  const lightboxItems = imageUrls.map((url, index) => ({
    altText: "",
    displayName: t("media.previewImage") + (imageUrls.length > 1 ? ` ${index + 1}` : ""),
    id: url,
    publicUrl: url,
    subtitle: thumbnail === url ? t("media.cover") : null,
  }));

  return (
    <div className="flex flex-col gap-4">
      <fieldset
        aria-label={t("media.title")}
        className={cn(
          "relative flex min-h-44 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed px-6 py-8 text-center transition-colors duration-200 ease-out",
          dragActive
            ? "border-primary bg-primary/5 ring-2 ring-primary/15"
            : "bg-muted/15 hover:border-foreground/20 hover:bg-muted/25",
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragActive(false);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void queueFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="grid size-12 place-items-center rounded-2xl border bg-background text-muted-foreground shadow-sm">
          <AppIcons.upload className="size-5" />
        </span>
        <div className="flex max-w-md flex-col gap-1">
          <p className="text-sm font-medium">{t("media.dropTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("media.dropDescription")}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => inputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            <AppIcons.image data-icon="inline-start" />
            {t("media.chooseFiles")}
          </Button>
          <MediaLibraryDialog
            onSelect={(assets) => {
              addUrls(
                assets
                  .map((asset) => asset.publicUrl)
                  .filter((url): url is string => Boolean(url)),
              );
            }}
            selectionMode="multiple"
          />
        </div>
        <div className="w-full max-w-md text-left">
          <MediaUrlImportField
            onImported={(file) => void queueFiles([file])}
            size="sm"
          />
        </div>
        <input
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          className="sr-only"
          multiple
          onChange={(event) => {
            void queueFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </fieldset>

      {hasImages ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {imageUrls.length ? (
                <Badge variant="secondary">
                  {t("media.imageCountReady", { count: imageUrls.length })}
                </Badge>
              ) : null}
              {pending.length ? (
                <Badge variant="outline">
                  {t("media.uploadingCount", { count: pending.length })}
                </Badge>
              ) : null}
              <span>{t("media.coverHint")}</span>
            </div>
          </div>

          {/*
            Bounded gallery: denser tiles + scroll so many images do not stretch the form.
            Horizontal scroll on small screens; wrapped grid with max-height on larger ones.
          */}
          {/*
            Viewport breakpoints still apply inside sheets/dialogs, so avoid 4–5
            columns that shrink tiles to stamps. Two larger tiles read clearly.
          */}
          <div className="max-h-[min(70vh,28rem)] overflow-y-auto overscroll-contain rounded-2xl border bg-muted/10 p-3 sm:max-h-[min(72vh,32rem)]">
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={reorderUploaded}
              sensors={sensors}
            >
              <SortableContext items={imageUrls} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-3">
                  {imageUrls.map((url, index) => (
                    <UploadedImage
                      isCover={thumbnail === url || (!thumbnail && index === 0)}
                      key={url}
                      onMakeCover={() => onThumbnailChange(url)}
                      onPreview={() => setLightboxIndex(index)}
                      onRemove={() => removeUploaded(url)}
                      url={url}
                    />
                  ))}
                  {pending.map((upload) => (
                    <PendingImage
                      key={upload.id}
                      onRemove={() => removePending(upload.id)}
                      onRetry={() => retryUpload(upload)}
                      upload={upload}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      ) : null}

      <MediaPreviewLightbox
        index={lightboxIndex}
        items={lightboxItems}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

function UploadedImage({
  isCover,
  onMakeCover,
  onPreview,
  onRemove,
  url,
}: {
  isCover: boolean;
  onMakeCover: () => void;
  onPreview: () => void;
  onRemove: () => void;
  url: string;
}) {
  const { t } = useI18n();
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: url,
  });

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow duration-200 ease-out",
        isCover && "ring-2 ring-primary/30",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button className="relative block w-full bg-muted text-left" onClick={onPreview} type="button">
        {/* biome-ignore lint/performance/noImgElement: Media URLs are runtime object-storage assets. */}
        <img
          alt=""
          className="aspect-square w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.02]"
          src={url}
        />
        <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent opacity-80" />
        {isCover ? (
          <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground shadow-sm">
            <AppIcons.starFill className="size-2.5" />
            {t("media.cover")}
          </span>
        ) : null}
        <span className="absolute right-1.5 bottom-1.5 rounded-full border border-white/20 bg-black/45 p-1 text-white opacity-0 transition-opacity duration-200 ease-out group-hover:opacity-100">
          <AppIcons.expand className="size-3" />
        </span>
      </button>

      <div className="flex items-center gap-0.5 border-t bg-card/95 p-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={t("media.reorder")}
              className="cursor-grab touch-none active:cursor-grabbing"
              size="icon-xs"
              type="button"
              variant="ghost"
              {...attributes}
              {...listeners}
            >
              <AppIcons.arrowUpDown />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("media.dragToReorder")}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isCover ? t("media.cover") : t("media.setAsCover")}
              disabled={isCover}
              onClick={onMakeCover}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              {isCover ? <AppIcons.starFill className="text-primary" /> : <AppIcons.star />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{isCover ? t("media.cover") : t("media.setAsCover")}</TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={t("media.remove")}
              onClick={onRemove}
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <AppIcons.close />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("media.remove")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function PendingImage({
  onRemove,
  onRetry,
  upload,
}: {
  onRemove: () => void;
  onRetry: () => void;
  upload: PendingUpload;
}) {
  const { t } = useI18n();
  const label =
    upload.status === "failed"
      ? t("media.failed")
      : upload.status === "processing"
        ? t("media.processing")
        : t("media.uploading");

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="relative">
        {/* biome-ignore lint/performance/noImgElement: This is a local object URL preview. */}
        <img
          alt=""
          className="aspect-square w-full object-cover opacity-70"
          src={upload.previewUrl}
        />
        {upload.status !== "failed" ? (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
            <div
              className="h-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${Math.max(4, upload.progress)}%` }}
            />
          </div>
        ) : null}
        <Badge
          className="absolute top-1.5 left-1.5 max-w-[calc(100%-0.75rem)] truncate"
          variant={upload.status === "failed" ? "destructive" : "secondary"}
        >
          {label}
        </Badge>
      </div>
      <div className="flex items-center gap-1 border-t p-1">
        <span className="min-w-0 flex-1 truncate px-1 text-[11px] text-muted-foreground">
          {upload.status === "failed" ? upload.error : `${upload.progress}%`}
        </span>
        {upload.status === "failed" && !validateFile(upload.file, t) ? (
          <Button onClick={onRetry} size="icon-xs" type="button" variant="ghost">
            <AppIcons.refresh />
          </Button>
        ) : null}
        <Button
          aria-label={t("media.remove")}
          onClick={onRemove}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <AppIcons.close />
        </Button>
      </div>
    </div>
  );
}

function validateFile(file: File, t: ReturnType<typeof useI18n>["t"]) {
  if (!acceptedTypes.has(file.type)) return t("media.invalidType");
  if (file.size > maxByteSize) return t("media.tooLarge");
  return null;
}

async function getImageDimensions(file: File) {
  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { height: bitmap.height, width: bitmap.width };
    bitmap.close();
    return dimensions;
  } catch {
    return {};
  }
}

function filenameToAltText(filename: string) {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim();
}
