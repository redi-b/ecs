"use client";

import { RiGalleryLine, RiImageLine, RiUploadCloud2Line } from "@remixicon/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { MediaLibraryDialog } from "./media-library-dialog";
import { MediaPreviewLightbox } from "./media-lightbox";
import { uploadMediaFile } from "./upload-media-file";

function isImagePreviewUrl(value: string) {
  return /^(?:https?:\/\/|data:image\/)/i.test(value);
}

export function MediaImageReferenceControl({
  compact = false,
  hideLabel = false,
  label,
  onChange,
  value,
}: {
  compact?: boolean;
  hideLabel?: boolean;
  label: string;
  onChange: (value: string | undefined) => void;
  value: string;
}) {
  const { t } = useI18n();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const imageUrl = isImagePreviewUrl(value) ? value : "";
  const preview = imageUrl ? [{ id: value, publicUrl: imageUrl, displayName: label }] : [];
  const thumbnail = (
    <button
      aria-label={imageUrl ? t("media.lightboxLabel") : label}
      className={cn(
        "group relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/35",
        compact ? "size-11" : "size-20",
        imageUrl &&
          "cursor-zoom-in transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
      disabled={!imageUrl}
      onClick={() => imageUrl && setLightboxIndex(0)}
      type="button"
    >
      {imageUrl ? (
        <>
          {/* biome-ignore lint/performance/noImgElement: User-selected public media is previewed at its source URL. */}
          <img alt="" className="size-full object-contain p-1.5" src={imageUrl} />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100 group-focus-visible:bg-black/35 group-focus-visible:opacity-100">
            <AppIcons.expand aria-hidden className="size-4" />
          </span>
        </>
      ) : (
        <RiImageLine aria-hidden className="size-5 text-muted-foreground" />
      )}
    </button>
  );

  return (
    <>
      <div
        className={cn(
          "flex min-w-0 items-center",
          compact ? "gap-2" : "gap-3 rounded-xl border bg-background p-3",
        )}
      >
        {thumbnail}
        {!compact ? (
          <div className="min-w-0 flex-1 space-y-2.5">
            {!hideLabel ? <p className="truncate text-sm font-medium">{label}</p> : null}
            <p className="truncate text-xs text-muted-foreground">
              {value ? t("editor.media.referenceSet") : t("editor.media.uploadOrChoose")}
            </p>
            <MediaImageSourceActions onPicked={onChange} />
          </div>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {value ? t("editor.media.referenceSet") : t("editor.media.uploadOrChoose")}
          </span>
        )}
        {compact ? <MediaImageSourceActions iconOnly onPicked={onChange} /> : null}
        {value ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("editor.media.clear")}
                className="size-8 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onChange(undefined)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <AppIcons.trash aria-hidden className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("editor.media.clear")}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <MediaPreviewLightbox
        index={lightboxIndex}
        items={preview}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </>
  );
}

export function MediaImageSourceActions({
  iconOnly = false,
  onPicked,
  onPickerOpenChange,
}: {
  iconOnly?: boolean;
  onPicked: (url: string | undefined) => void;
  onPickerOpenChange?: ((open: boolean) => void) | undefined;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMediaFile(file);
      onPicked(url);
      toast.success(t("editor.toast.imageUploaded"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "upload_failed";
      toast.error(
        code === "invalid_type"
          ? t("editor.toast.unsupportedImage")
          : code === "too_large"
            ? t("editor.toast.imageTooLarge")
            : t("editor.toast.imageUploadFailed"),
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={iconOnly ? "flex shrink-0 items-center gap-1" : "flex min-w-0 flex-wrap gap-2"}>
      <input
        accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
        ref={inputRef}
        type="file"
      />
      {iconOnly ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={t("editor.media.uploadImage")}
              className="size-8 shrink-0 p-0"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              <RiUploadCloud2Line aria-hidden className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("editor.media.uploadImage")}</TooltipContent>
        </Tooltip>
      ) : (
        <Button
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RiUploadCloud2Line data-icon="inline-start" />
          {uploading ? t("editor.media.uploading") : t("editor.media.uploadImage")}
        </Button>
      )}
      <MediaLibraryDialog
        onOpenChange={onPickerOpenChange}
        onSelect={(assets) => {
          const url = assets[0]?.publicUrl?.trim();
          if (url) onPicked(url);
        }}
        selectionMode="single"
        triggerClassName={iconOnly ? "size-8 shrink-0 p-0" : undefined}
        triggerContent={
          iconOnly ? (
            <>
              <RiGalleryLine aria-hidden className="size-4" />
              <span className="sr-only">{t("editor.media.chooseLibrary")}</span>
            </>
          ) : undefined
        }
        triggerLabel={t("editor.media.chooseLibrary")}
        triggerSize={iconOnly ? "xs" : "sm"}
        triggerVariant="outline"
      />
    </div>
  );
}
