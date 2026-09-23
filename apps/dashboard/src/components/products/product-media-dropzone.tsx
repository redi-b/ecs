"use client";

import { useEffect, useId, useRef, useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/provider";
import {
  DEFAULT_MEDIA_LIMITS,
  type MediaLimitsConfig,
  getMediaUploadConfig,
} from "@/lib/merchant-media";
import { cn } from "@/lib/utils";

export function formatMimeTypeLabel(mime: string): string {
  const map: Record<string, string> = {
    "image/avif": "AVIF",
    "image/gif": "GIF",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WebP",
  };
  return map[mime.toLowerCase()] || mime.replace(/^image\//i, "").toUpperCase();
}

export function formatConstraintsBadge(config: MediaLimitsConfig): string {
  const types = config.allowedMimeTypes.map(formatMimeTypeLabel).join(", ");
  return `Max ${config.formattedMaxSize} per file • Up to ${config.maxFilesPerBatch} files • ${types}`;
}

export type FileValidationResult = {
  acceptedFiles: File[];
  errors: string[];
  rejectedFiles: { file: File; reason: string }[];
  valid: boolean;
};

export function validateMediaFiles(
  files: File[],
  config: MediaLimitsConfig = DEFAULT_MEDIA_LIMITS,
): FileValidationResult {
  const errors: string[] = [];
  const acceptedFiles: File[] = [];
  const rejectedFiles: { file: File; reason: string }[] = [];

  if (files.length > config.maxFilesPerBatch) {
    const errorMsg = `Too many files: maximum ${config.maxFilesPerBatch} files allowed per batch (selected ${files.length})`;
    errors.push(errorMsg);
  }

  for (const file of files) {
    let fileError: string | null = null;

    if (config.allowedMimeTypes.length > 0 && !config.allowedMimeTypes.includes(file.type)) {
      fileError = `File "${file.name}" has unsupported type (${file.type || "unknown"})`;
    } else if (file.size > config.maxFileBytes) {
      fileError = `File "${file.name}" exceeds maximum size of ${config.formattedMaxSize}`;
    }

    if (fileError) {
      rejectedFiles.push({ file, reason: fileError });
      if (!errors.includes(fileError)) {
        errors.push(fileError);
      }
    } else {
      acceptedFiles.push(file);
    }
  }

  return {
    acceptedFiles,
    errors,
    rejectedFiles,
    valid: errors.length === 0 && rejectedFiles.length === 0,
  };
}

export interface ProductMediaDropzoneProps {
  className?: string;
  config?: MediaLimitsConfig;
  disabled?: boolean;
  hasImages?: boolean;
  onFilesRejected?: (rejected: { file: File; reason: string }[]) => void;
  onFilesSelected?: (files: File[]) => void;
  secondaryAction?: React.ReactNode;
}

export function ProductMediaDropzone({
  className,
  config: propConfig,
  disabled = false,
  hasImages = false,
  onFilesRejected,
  onFilesSelected,
  secondaryAction,
}: ProductMediaDropzoneProps) {
  const { t } = useI18n();
  const [config, setConfig] = useState<MediaLimitsConfig>(propConfig ?? DEFAULT_MEDIA_LIMITS);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    if (propConfig) {
      setConfig(propConfig);
      return;
    }
    let cancelled = false;
    void getMediaUploadConfig().then((fetched) => {
      if (!cancelled && fetched) {
        setConfig(fetched);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [propConfig]);

  const constraintText = formatConstraintsBadge(config);

  function handleFiles(incoming: File[]) {
    setValidationError(null);
    if (!incoming.length) return;

    const validation = validateMediaFiles(incoming, config);

    if (validation.rejectedFiles.length > 0) {
      onFilesRejected?.(validation.rejectedFiles);
    }

    if (!validation.valid) {
      const primaryError = validation.errors[0] || t("media.uploadError");
      setValidationError(primaryError);
      if (validation.acceptedFiles.length > 0) {
        onFilesSelected?.(validation.acceptedFiles);
      }
      return;
    }

    onFilesSelected?.(validation.acceptedFiles);
  }

  return (
    <div className="flex flex-col gap-2">
      <fieldset
        aria-label={t("media.title")}
        className={cn(
          "relative flex overflow-hidden rounded-2xl border border-dashed transition-colors duration-200 ease-out",
          hasImages
            ? "min-h-16 flex-col items-stretch justify-center gap-3 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            : "min-h-44 flex-col items-center justify-center gap-3 px-6 py-8 text-center",
          dragActive
            ? "border-primary bg-primary/5 ring-2 ring-primary/15"
            : "bg-muted/15 hover:border-foreground/20 hover:bg-muted/25",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
        onDragEnter={(event) => {
          event.preventDefault();
          if (disabled) return;
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          if (event.currentTarget === event.target) setDragActive(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          if (disabled) return;
          handleFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div className={cn("flex items-center", hasImages ? "gap-2" : "flex-col gap-3")}>
          <span
            className={cn(
              "grid shrink-0 place-items-center border bg-background text-muted-foreground",
              hasImages ? "size-8 rounded-lg" : "size-10 rounded-xl",
            )}
          >
            {hasImages ? (
              <AppIcons.image className="size-4" />
            ) : (
              <AppIcons.upload className="size-5" />
            )}
          </span>
          <div className={cn("flex max-w-md flex-col gap-1", hasImages || "items-center")}>
            <p className="text-sm font-medium">
              {hasImages ? t("media.addMore") : t("media.dropTitle")}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <Badge
                className="h-auto max-w-full px-2.5 py-1 text-center font-normal leading-relaxed tracking-wide whitespace-normal"
                data-testid="media-constraints-badge"
                variant="outline"
              >
                {constraintText}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            size="sm"
            type="button"
            variant="outline"
          >
            <AppIcons.image data-icon="inline-start" />
            {t("media.chooseFiles")}
          </Button>
          {secondaryAction}
        </div>

        <input
          accept={config.allowedMimeTypes.join(",")}
          className="sr-only"
          disabled={disabled}
          id={inputId}
          multiple
          onChange={(event) => {
            event.stopPropagation();
            handleFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
          ref={inputRef}
          type="file"
        />
      </fieldset>

      {validationError ? (
        <div
          className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {validationError}
        </div>
      ) : null}
    </div>
  );
}
