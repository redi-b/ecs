"use client";

import { RiImageLine } from "@remixicon/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";

import { MediaLibraryDialog } from "./media-library-dialog";
import { MediaUrlImportField } from "./media-url-import-field";
import { uploadMediaFile } from "./upload-media-file";

function isImagePreviewUrl(value: string) {
  return /^(?:https?:\/\/|data:image\/)/i.test(value);
}

export function MediaImageReferenceControl({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string | undefined) => void;
  value: string;
}) {
  const { t } = useI18n();
  const imageUrl = isImagePreviewUrl(value) ? value : "";

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="size-full object-cover" src={imageUrl} />
          ) : (
            <RiImageLine aria-hidden className="text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-pretty text-muted-foreground">
            {value ? t("editor.media.referenceSet") : t("editor.media.uploadOrChoose")}
          </div>
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
}: {
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
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => void handleFiles(event.target.files)}
          ref={inputRef}
          type="file"
        />
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
        <MediaLibraryDialog
          onOpenChange={onPickerOpenChange}
          onSelect={(assets) => {
            const url = assets[0]?.publicUrl?.trim();
            if (url) onPicked(url);
          }}
          selectionMode="single"
          triggerClassName="w-full min-w-0 sm:w-auto"
          triggerLabel={t("editor.media.chooseLibrary")}
          triggerSize="sm"
          triggerVariant="outline"
        />
      </div>
      <MediaUrlImportField
        className="min-w-0"
        disabled={uploading}
        onImported={(file) => {
          void (async () => {
            try {
              const publicUrl = await uploadMediaFile(file);
              onPicked(publicUrl);
              toast.success(t("editor.toast.imageImported"));
            } catch {
              toast.error(t("editor.toast.imageImportFailed"));
            }
          })();
        }}
        size="sm"
      />
    </div>
  );
}
