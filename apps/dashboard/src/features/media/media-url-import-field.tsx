"use client";

import { useState } from "react";

import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { importRemoteImageAsFile, mapImportUrlError } from "./import-remote-image";

type MediaUrlImportFieldProps = {
  className?: string;
  disabled?: boolean;
  onImported: (file: File) => void;
  /** Compact single-row layout for dense toolbars. */
  size?: "default" | "sm";
};

export function MediaUrlImportField({
  className,
  disabled,
  onImported,
  size = "default",
}: MediaUrlImportFieldProps) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function importUrl() {
    const trimmed = url.trim();
    if (!trimmed || importing || disabled) return;

    setImporting(true);
    setError(null);
    try {
      const file = await importRemoteImageAsFile(trimmed);
      onImported(file);
      setUrl("");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : "fetch_failed";
      setError(mapImportUrlError(code, t));
    } finally {
      setImporting(false);
    }
  }

  const compact = size === "sm";

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {/*
        Stack on narrow widths so the Import button never crushes the URL field.
        Side-by-side only from sm when there is room.
      */}
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          aria-label={t("media.importUrlLabel")}
          className={cn(compact ? "h-8" : "h-9", "min-w-0 w-full flex-1")}
          disabled={disabled || importing}
          onChange={(event) => {
            setUrl(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void importUrl();
            }
          }}
          placeholder={t("media.importUrlPlaceholder")}
          type="url"
          value={url}
        />
        <Button
          aria-busy={importing}
          className={cn(
            compact ? "h-8" : "h-9",
            "w-full shrink-0 sm:w-auto",
          )}
          disabled={disabled || importing || !url.trim()}
          onClick={() => void importUrl()}
          size={compact ? "sm" : "default"}
          type="button"
          variant="outline"
        >
          {importing ? (
            <>
              <AppIcons.loader className="animate-spin" data-icon="inline-start" />
              {t("media.importUrlImporting")}
            </>
          ) : (
            <>
              <AppIcons.link data-icon="inline-start" />
              {t("media.importUrlAction")}
            </>
          )}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {!error ? (
        <p className="text-xs text-pretty text-muted-foreground">{t("media.importUrlHint")}</p>
      ) : null}
    </div>
  );
}
