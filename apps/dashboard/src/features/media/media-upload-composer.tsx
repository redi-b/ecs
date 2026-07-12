"use client";

import AwsS3 from "@uppy/aws-s3";
import Uppy, { type UppyFile } from "@uppy/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { filenameToAlt, formatBytes, getImageDimensions } from "./media-helpers";
import { MediaPreviewLightbox } from "./media-lightbox";
import { createMediaUploadId } from "./media-upload-id";
import {
  mapUppyFileToQueueView,
  MediaUploadQueue,
  type QueueFileView,
} from "./media-upload-queue";
import { MediaUrlImportField } from "./media-url-import-field";

type UploadMeta = { assetId?: string };
const allowedTypes = ["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"];

type CompletionState = "idle" | "processing" | "done" | "failed";

export function MediaUploadComposer({ onUploaded }: { onUploaded: () => void }) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef(new Map<string, string>());
  const completionRef = useRef(new Map<string, CompletionState>());
  const onUploadedRef = useRef(onUploaded);
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueCollapsed, setQueueCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const dragDepth = useRef(0);
  const lightboxOpen = previewIndex !== null;

  useEffect(() => {
    onUploadedRef.current = onUploaded;
  }, [onUploaded]);

  const [uppy] = useState(() =>
    new Uppy<UploadMeta, Record<string, never>>({
      autoProceed: false,
      restrictions: { allowedFileTypes: allowedTypes, maxFileSize: 15 * 1024 * 1024 },
    }).use(AwsS3, {
      async getUploadParameters(file) {
        const response = await fetch("/admin/media/uploads", {
          body: JSON.stringify({
            byteSize: file.size,
            context: "media-library",
            filename: file.name,
            mimeType: file.type,
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        });
        const data = (await response.json().catch(() => null)) as {
          asset?: { id?: string };
          headers?: Record<string, string>;
          uploadUrl?: string;
        } | null;
        if (!response.ok || !data?.asset?.id || !data.uploadUrl) throw new Error("create_failed");
        uppy.setFileMeta(file.id, { assetId: data.asset.id });
        return { headers: data.headers ?? {}, method: "PUT" as const, url: data.uploadUrl };
      },
      shouldUseMultipart: false,
    }),
  );

  const bump = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    const added = (file: UppyFile<UploadMeta, Record<string, never>>) => {
      previewUrls.current.set(file.id, URL.createObjectURL(file.data as File));
      completionRef.current.set(file.id, "idle");
      bump();
    };
    const removed = (file: UppyFile<UploadMeta, Record<string, never>>) => {
      const preview = previewUrls.current.get(file.id);
      if (preview) URL.revokeObjectURL(preview);
      previewUrls.current.delete(file.id);
      completionRef.current.delete(file.id);
      bump();
    };
    uppy.on("file-added", added);
    uppy.on("file-removed", removed);
    uppy.on("upload-progress", bump);
    uppy.on("upload-error", bump);
    uppy.on("upload-success", bump);
    return () => {
      uppy.off("file-added", added);
      uppy.off("file-removed", removed);
      uppy.off("upload-progress", bump);
      uppy.off("upload-error", bump);
      uppy.off("upload-success", bump);
      uppy.cancelAll();
      previewUrls.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      previewUrls.current.clear();
      completionRef.current.clear();
    };
  }, [bump, uppy]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is the external-store invalidation signal.
  const files = useMemo(() => uppy.getFiles(), [revision, uppy]);

  const queueFiles: QueueFileView[] = useMemo(
    () =>
      files.map((file) =>
        mapUppyFileToQueueView(
          file,
          previewUrls.current.get(file.id),
          completionRef.current.get(file.id) ?? "idle",
        ),
      ),
    [files],
  );

  const stagedFiles = useMemo(
    () =>
      files.filter((file) => {
        const state = completionRef.current.get(file.id) ?? "idle";
        return state === "idle" && !file.progress?.uploadStarted;
      }),
    [files],
  );

  const addFiles = useCallback(
    (incoming: File[]) => {
      let added = 0;
      for (const file of incoming) {
        try {
          uppy.addFile({ data: file, id: createMediaUploadId(), name: file.name, type: file.type });
          added += 1;
        } catch {
          toast.error(t("media.invalidType"));
        }
      }
      if (added) setOpen(true);
    },
    [t, uppy],
  );

  useEffect(() => {
    const enter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      dragDepth.current += 1;
      setDragging(true);
    };
    const leave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    };
    const over = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      addFiles(Array.from(event.dataTransfer?.files ?? []));
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [addFiles]);

  async function completeFile(file: UppyFile<UploadMeta, Record<string, never>>) {
    const assetId = file.meta.assetId;
    if (!assetId) return false;
    completionRef.current.set(file.id, "processing");
    bump();
    const source = file.data as File;
    const dimensions = await getImageDimensions(source);
    const response = await fetch(`/admin/media/uploads/${encodeURIComponent(assetId)}/complete`, {
      body: JSON.stringify({ altText: filenameToAlt(source.name), ...dimensions }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    completionRef.current.set(file.id, response.ok ? "done" : "failed");
    bump();
    return response.ok;
  }

  async function confirmUpload() {
    if (!stagedFiles.length || uploading) return;
    setPreviewIndex(null);
    setOpen(false);
    setQueueOpen(true);
    setQueueCollapsed(false);
    setUploading(true);
    toast.message(t("media.uploadStarted"));

    const result = await uppy.upload();
    if (!result) {
      setUploading(false);
      toast.error(t("media.uploadError"));
      bump();
      return;
    }

    let completed = 0;
    for (const file of result.successful ?? []) {
      if (await completeFile(file)) completed += 1;
    }
    for (const file of result.failed ?? []) {
      completionRef.current.set(file.id, "failed");
    }

    setUploading(false);
    bump();

    if (completed) {
      toast.success(t("media.batchUploaded", { count: completed }));
      onUploadedRef.current();
    }
    if (result.failed?.length) {
      toast.error(t("media.batchFailed", { count: result.failed.length }));
    }
  }

  function clearFinished() {
    for (const file of uppy.getFiles()) {
      const state = completionRef.current.get(file.id);
      if (state === "done" || state === "failed") {
        uppy.removeFile(file.id);
      }
    }
    if (!uppy.getFiles().length) setQueueOpen(false);
    bump();
  }

  function dismissQueue() {
    for (const file of uppy.getFiles()) {
      const state = completionRef.current.get(file.id) ?? "idle";
      if (state === "done" || state === "failed" || state === "idle") {
        uppy.removeFile(file.id);
      }
    }
    setQueueOpen(false);
    bump();
  }

  async function retryFailed() {
    const failed = uppy.getFiles().filter((file) => {
      const state = completionRef.current.get(file.id);
      return state === "failed" || Boolean(file.error);
    });
    if (!failed.length) return;

    for (const file of failed) {
      completionRef.current.set(file.id, "idle");
      uppy.setFileState(file.id, {
        error: null,
        progress: {
          bytesTotal: file.size ?? 0,
          bytesUploaded: 0,
          percentage: 0,
          uploadComplete: false,
          uploadStarted: 0,
        },
      });
    }
    bump();
    setUploading(true);
    setQueueCollapsed(false);

    const result = await uppy.upload();
    let completed = 0;
    for (const file of result?.successful ?? []) {
      if (await completeFile(file)) completed += 1;
    }
    for (const file of result?.failed ?? []) {
      completionRef.current.set(file.id, "failed");
    }
    setUploading(false);
    bump();
    if (completed) {
      toast.success(t("media.batchUploaded", { count: completed }));
      onUploadedRef.current();
    }
  }

  const previewItems = stagedFiles.map((file) => ({
    altText: file.name,
    displayName: file.name ?? "image",
    id: file.id,
    publicUrl: previewUrls.current.get(file.id) ?? "",
    subtitle: formatBytes(file.size ?? 0),
  }));

  const totalBytes = stagedFiles.reduce((sum, file) => sum + (file.size ?? 0), 0);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        <AppIcons.upload data-icon="inline-start" />
        {t("media.uploadNew")}
      </Button>
      <input
        accept={allowedTypes.join(",")}
        className="sr-only"
        multiple
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />

      {dragging ? (
        <div className="fixed inset-3 z-[80] grid place-items-center rounded-2xl border-2 border-dashed border-primary bg-background/95 p-8 shadow-xl animate-in fade-in-0 duration-200 ease-out">
          <div className="text-center">
            <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl border bg-muted">
              <AppIcons.upload className="size-6" />
            </span>
            <p className="text-lg font-semibold">{t("media.dropPageTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("media.dropPageDescription")}</p>
          </div>
        </div>
      ) : null}

      <Dialog
        onOpenChange={(next) => {
          if (uploading) return;
          // Keep composer open while nested lightbox is showing.
          if (!next && lightboxOpen) return;
          setOpen(next);
        }}
        open={open}
      >
        <DialogContent
          className="flex max-h-[min(90vh,52rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
          onEscapeKeyDown={(event) => {
            if (lightboxOpen) {
              event.preventDefault();
              setPreviewIndex(null);
            }
          }}
          onInteractOutside={(event) => {
            if (lightboxOpen) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (lightboxOpen) event.preventDefault();
          }}
          showCloseButton
        >
          <DialogHeader className="shrink-0 gap-1.5 border-b px-4 py-4 text-left sm:px-5">
            <DialogTitle className="text-xl">{t("media.uploadComposerTitle")}</DialogTitle>
            <DialogDescription>{t("media.uploadComposerDescription")}</DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(16rem,18rem)]">
            <div className="flex min-h-0 flex-col gap-4 overflow-hidden p-4 sm:p-5">
              <button
                className={cn(
                  "group relative flex min-h-36 w-full shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-7 text-center transition-colors",
                  "bg-muted/15 hover:border-primary/40 hover:bg-muted/30",
                )}
                onClick={() => inputRef.current?.click()}
                type="button"
              >
                <span className="grid size-12 place-items-center rounded-2xl border bg-background shadow-sm transition-transform duration-200 ease-out group-hover:scale-[1.02]">
                  <AppIcons.upload className="size-5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-sm font-medium">{t("media.dropZoneHint")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("media.supportedFormats")}</p>
                </div>
                <span className="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium">
                  {t("media.browseFiles")}
                </span>
              </button>

              <div className="rounded-2xl border bg-card/60 p-3 sm:p-3.5">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {t("media.importUrlSection")}
                </p>
                <MediaUrlImportField
                  disabled={uploading}
                  onImported={(file) => addFiles([file])}
                  size="sm"
                />
              </div>

              {stagedFiles.length ? (
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-2xl border">
                  <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4">
                    {stagedFiles.map((file, index) => (
                      <li
                        className="group/item relative overflow-hidden rounded-xl border bg-card shadow-sm"
                        key={file.id}
                      >
                        <button
                          className="block w-full text-left"
                          onClick={() => setPreviewIndex(index)}
                          type="button"
                        >
                          <div className="relative aspect-square bg-muted">
                            {/* biome-ignore lint/performance/noImgElement: Local object URL preview. */}
                            <img
                              alt=""
                              className="size-full object-cover transition-transform duration-200 ease-out group-hover/item:scale-[1.02]"
                              src={previewUrls.current.get(file.id)}
                            />
                            <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition-all duration-200 ease-out group-hover/item:bg-black/25 group-hover/item:opacity-100">
                              <span className="rounded-full border border-white/20 bg-black/50 p-2 text-white">
                                <AppIcons.expand className="size-4" />
                              </span>
                            </span>
                          </div>
                        </button>
                        <div className="flex items-start gap-1 border-t p-2">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">{file.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatBytes(file.size ?? 0)}
                            </p>
                          </div>
                          <Button
                            aria-label={t("media.remove")}
                            onClick={() => uppy.removeFile(file.id)}
                            size="icon-xs"
                            type="button"
                            variant="ghost"
                          >
                            <AppIcons.close />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex min-h-44 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/10 px-6 py-10 text-center">
                  <span className="mb-3 grid size-11 place-items-center rounded-xl border bg-background text-muted-foreground">
                    <AppIcons.image />
                  </span>
                  <p className="text-sm font-medium">{t("media.reviewEmpty")}</p>
                </div>
              )}
            </div>

            <aside className="flex flex-col gap-4 border-t bg-muted/15 p-4 sm:p-5 lg:border-t-0 lg:border-l">
              <div>
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {t("media.readyCount", { count: stagedFiles.length })}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {stagedFiles.length}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {stagedFiles.length === 1
                      ? t("media.imageSingular")
                      : t("media.imagePlural")}
                  </span>
                </p>
              </div>
              <div className="space-y-2 rounded-xl border bg-background/80 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("media.size")}</span>
                  <span className="font-medium">{formatBytes(totalBytes)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">{t("media.type")}</span>
                  <Badge variant="outline">{t("media.imagesLabel")}</Badge>
                </div>
              </div>
              <div className="mt-auto flex flex-col gap-2">
                {stagedFiles.length ? (
                  <Button
                    onClick={() => {
                      for (const file of stagedFiles) uppy.removeFile(file.id);
                    }}
                    type="button"
                    variant="ghost"
                  >
                    {t("media.clearQueue")}
                  </Button>
                ) : null}
                <Button onClick={() => inputRef.current?.click()} type="button" variant="outline">
                  <AppIcons.image data-icon="inline-start" />
                  {t("media.addMore")}
                </Button>
              </div>
            </aside>
          </div>

          {/*
            DialogFooter assumes DialogContent padding (p-4) and uses -mx-4 -mb-4.
            This composer uses p-0, so match the footer chrome with a plain flush footer.
          */}
          <div
            className={cn(
              "flex shrink-0 flex-col-reverse gap-2 border-t bg-muted/50 p-4",
              "sm:flex-row sm:items-center sm:justify-between",
            )}
            data-slot="dialog-footer"
          >
            <p className="text-center text-xs text-muted-foreground sm:text-left">
              {t("media.readyCount", { count: stagedFiles.length })}
              {totalBytes ? ` · ${formatBytes(totalBytes)}` : ""}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                {t("common.cancel")}
              </Button>
              <Button
                disabled={!stagedFiles.length || uploading}
                onClick={() => void confirmUpload()}
                type="button"
              >
                <AppIcons.upload data-icon="inline-start" />
                {t("media.startUpload")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MediaUploadQueue
        collapsed={queueCollapsed}
        files={queueFiles}
        onClearFinished={clearFinished}
        onCollapseChange={setQueueCollapsed}
        onDismiss={dismissQueue}
        onRemove={(fileId) => uppy.removeFile(fileId)}
        onRetryFailed={() => void retryFailed()}
        open={queueOpen}
      />

      <MediaPreviewLightbox
        index={previewIndex}
        items={previewItems}
        onClose={() => setPreviewIndex(null)}
        onIndexChange={setPreviewIndex}
      />
    </>
  );
}

function hasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files");
}
