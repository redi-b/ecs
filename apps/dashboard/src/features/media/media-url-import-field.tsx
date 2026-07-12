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

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className={cn("flex gap-2", size === "sm" ? "items-center" : "flex-col sm:flex-row")}>
        <Input
          aria-label={t("media.importUrlLabel")}
          className={cn(size === "sm" ? "h-8" : "h-9", "min-w-0 flex-1")}
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
          className={cn(size === "sm" ? "h-8 shrink-0" : "h-9 shrink-0")}
          disabled={disabled || importing || !url.trim()}
          onClick={() => void importUrl()}
          size={size === "sm" ? "sm" : "default"}
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
        <p className="text-xs text-muted-foreground">{t("media.importUrlHint")}</p>
      ) : null}
    </div>
  );
}
