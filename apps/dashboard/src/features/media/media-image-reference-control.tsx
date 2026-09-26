"use client";

import { RiDeleteBinLine, RiGalleryLine, RiImageLine, RiUploadCloud2Line } from "@remixicon/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n/provider";

import { MediaLibraryDialog } from "./media-library-dialog";
import { uploadMediaFile } from "./upload-media-file";

function isImagePreviewUrl(value: string) {
  return /^(?:https?:\/\/|data:image\/)/i.test(value);
}

export function MediaImageReferenceControl({
  label,
  onChange,
  value,
  compact = false,
}: {
  label: string;
  onChange: (value: string | undefined) => void;
  value: string;
  compact?: boolean;
}) {
  const { t } = useI18n();
  const imageUrl = isImagePreviewUrl(value) ? value : "";

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted/50">
          {imageUrl ? (
            // eslint-disable-next-line /next/no-img-element
            <img alt="" className="size-full object-contain" src={imageUrl} />
          ) : (
            <RiImageLine aria-hidden className="size-4 text-muted-foreground" />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {value ? t("editor.media.referenceSet") : t("editor.media.uploadOrChoose")}
        </span>
        <MediaImageSourceActions iconOnly onPicked={onChange} />
        {value ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={t("editor.media.clear")}
                className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(undefined)}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <RiDeleteBinLine aria-hidden className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("editor.media.clear")}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full object-contain" src={imageUrl} />
          ) : (
            <RiImageLine aria-hidden className="text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
        </div>
        {value ? (
          <Button
            className="shrink-0"
            onClick={() => onChange(undefined)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {t("editor.media.clear")}
          </Button>
        ) : null}
      </div>
      <MediaImageSourceActions onPicked={onChange} />
    </div>
  );
}

export function MediaImageSourceActions({
  onPicked,
  onPickerOpenChange,
  iconOnly = false,
}: {
  onPicked: (url: string | undefined) => void;
  onPickerOpenChange?: ((open: boolean) => void) | undefined;
  iconOnly?: boolean;
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
    <div
      className={
        iconOnly
          ? "flex shrink-0 items-center gap-1"
          : "flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap"
      }
    >
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
          className="w-full min-w-0 justify-center sm:w-auto"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          <RiImageLine data-icon="inline-start" />
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
        triggerClassName={iconOnly ? "size-8 shrink-0 p-0" : "w-full min-w-0 sm:w-auto"}
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
