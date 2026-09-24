"use client";

import type { ProductOptionSwatch } from "@ecs/contracts";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MediaLibraryDialog } from "@/features/media/media-library-dialog";
import { uploadMediaFile } from "@/features/media/upload-media-file";
import { ColorPickerField } from "@/features/storefront-editor/editor-theme";
import { useI18n } from "@/i18n/provider";
import { rankFuzzyItems } from "@/lib/fuzzy-search";
import { cn } from "@/lib/utils";

export const COMMON_PRODUCT_COLORS = [
  ["Black", "#111111"],
  ["White", "#ffffff"],
  ["Gray", "#6b7280"],
  ["Silver", "#c0c0c0"],
  ["Red", "#dc2626"],
  ["Burgundy", "#7f1d1d"],
  ["Orange", "#ea580c"],
  ["Yellow", "#eab308"],
  ["Gold", "#d4af37"],
  ["Green", "#16a34a"],
  ["Olive", "#808000"],
  ["Teal", "#0f766e"],
  ["Blue", "#2563eb"],
  ["Navy", "#1e3a8a"],
  ["Purple", "#9333ea"],
  ["Lavender", "#a78bfa"],
  ["Pink", "#db2777"],
  ["Rose", "#e11d48"],
  ["Brown", "#78350f"],
  ["Tan", "#d2b48c"],
  ["Beige", "#e7dcc8"],
  ["Ivory", "#fffff0"],
  ["Cream", "#fffdd0"],
  ["Clear", "#f8fafc"],
] as const;

export const COMMON_PRODUCT_COLOR_OPTIONS = COMMON_PRODUCT_COLORS.map(([label, value]) => ({
  label,
  value,
  keywords: `${label} ${value}`,
}));

export function normalizeProductOptionSwatch(
  value: ProductOptionSwatch | string | null | undefined,
): ProductOptionSwatch | undefined {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://") ||
      trimmed.startsWith("/")
    ) {
      return { kind: "image", url: trimmed };
    }
    return { kind: "color", value: trimmed.toLowerCase() };
  }
  if (value.kind === "image") {
    return { kind: "image", url: value.url.trim() };
  }
  if (value.kind === "color") {
    return { kind: "color", value: value.value.toLowerCase() };
  }
  return undefined;
}

export function serializeProductOptionSwatch(
  swatch: ProductOptionSwatch | string | null | undefined,
): string | null {
  const normalized = normalizeProductOptionSwatch(swatch);
  if (!normalized) return null;
  if (normalized.kind === "image") {
    return normalized.url;
  }
  return normalized.value.toLowerCase();
}

export function getSwatchMode(
  value: ProductOptionSwatch | string | null | undefined,
): "color" | "image" {
  const normalized = normalizeProductOptionSwatch(value);
  return normalized?.kind === "image" ? "image" : "color";
}

export function buildProductOptionSwatch(
  mode: "color" | "image",
  colorValue: string,
  imageUrl: string,
): ProductOptionSwatch {
  if (mode === "image") {
    return { kind: "image", url: imageUrl.trim() };
  }
  return { kind: "color", value: colorValue.toLowerCase() };
}
export function ProductOptionSwatchPreview({
  className,
  value,
}: {
  className?: string | undefined;
  value: ProductOptionSwatch | string | null | undefined;
}) {
  const swatch = normalizeProductOptionSwatch(value);
  if (!swatch) return null;

  if (swatch.kind === "image") {
    return (
      <img
        alt=""
        aria-hidden="true"
        className={cn("size-4 shrink-0 rounded-full border object-cover shadow-xs", className)}
        src={swatch.url}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn("size-4 shrink-0 rounded-full border shadow-xs", className)}
      style={{ backgroundColor: swatch.value }}
    />
  );
}

/**
 * Visual option titles indicate options where visual swatches (color or texture) are appropriate.
 * Material is excluded so it remains descriptive text pills (e.g. "100% Linen", "Full Grain Leather").
 */
export function isVisualOptionTitle(title: string) {
  return /^(colou?r|pattern|fabric|texture|finish)$/i.test(title.trim());
}
export const isColorOptionTitle = isVisualOptionTitle;

export function getAddSwatchLabel(optionTitle?: string): string {
  const norm = (optionTitle ?? "").trim().toLowerCase();
  if (/^colou?r$/i.test(norm)) return "Add color";
  if (/^pattern$/i.test(norm)) return "Add pattern";
  if (/^fabric$/i.test(norm)) return "Add swatch";
  return "Add swatch";
}

export function ProductColorPopover({
  galleryImages: _galleryImages,
  label,
  onSave,
  optionTitle,
  value,
}: {
  galleryImages?: string[] | undefined;
  label?: string | undefined;
  onSave: (label: string, swatch: ProductOptionSwatch) => void;
  optionTitle?: string | undefined;
  value?: ProductOptionSwatch | string | null | undefined;
}) {
  const { t } = useI18n();
  const normalizedSwatch = normalizeProductOptionSwatch(value);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"browse" | "custom">("browse");
  const [query, setQuery] = useState("");
  const [customLabel, setCustomLabel] = useState(label ?? "");
  const [customMode, setCustomMode] = useState<"color" | "image">(
    normalizedSwatch?.kind === "image" ? "image" : "color",
  );
  const [customColor, setCustomColor] = useState(
    normalizedSwatch?.kind === "color"
      ? normalizedSwatch.value
      : typeof value === "string" && !value.startsWith("http") && !value.startsWith("/")
        ? value
        : "#808080",
  );
  const [customImageUrl, setCustomImageUrl] = useState(
    normalizedSwatch?.kind === "image"
      ? normalizedSwatch.url
      : typeof value === "string" && (value.startsWith("http") || value.startsWith("/"))
        ? value
        : "",
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileDialogPendingRef = useRef(false);
  const uploadInProgressRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const filtered = rankFuzzyItems(COMMON_PRODUCT_COLOR_OPTIONS, query, (item) => item.keywords);

  useEffect(() => {
    if (!open || step !== "browse") return;
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, step]);

  function close() {
    setOpen(false);
    setQuery("");
    setStep("browse");
  }

  function handleOpenChange(next: boolean) {
    if (!next && (fileDialogPendingRef.current || uploadInProgressRef.current)) return;
    setOpen(next);
    if (next) {
      const current = normalizeProductOptionSwatch(value);
      setCustomLabel(label ?? "");
      const mode = current?.kind === "image" ? "image" : "color";
      setCustomMode(mode);
      setCustomColor(
        current?.kind === "color"
          ? current.value
          : typeof value === "string" && !value.startsWith("http") && !value.startsWith("/")
            ? value
            : "#808080",
      );
      setCustomImageUrl(
        current?.kind === "image"
          ? current.url
          : typeof value === "string" && (value.startsWith("http") || value.startsWith("/"))
            ? value
            : "",
      );
      setStep(current?.kind === "image" ? "custom" : "browse");
    } else {
      setQuery("");
      setStep("browse");
    }
  }
  function openFilePicker() {
    fileDialogPendingRef.current = true;
    const clearPending = () => {
      window.setTimeout(() => {
        fileDialogPendingRef.current = false;
      }, 0);
    };
    window.addEventListener("focus", clearPending, { once: true });
    fileInputRef.current?.click();
  }
  async function handleFileUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    uploadInProgressRef.current = true;
    setUploading(true);
    try {
      const url = await uploadMediaFile(file);
      setCustomImageUrl(url);
      setCustomMode("image");
      setStep("custom");
      setOpen(true);
      if (!customLabel.trim()) {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setCustomLabel(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
      toast.success(t("products.swatch.uploaded"));
    } catch (error) {
      const code = error instanceof Error ? error.message : "upload_failed";
      toast.error(
        code === "invalid_type"
          ? t("media.invalidType")
          : code === "too_large"
            ? t("media.tooLarge")
            : t("products.swatch.uploadError"),
      );
    } finally {
      fileDialogPendingRef.current = false;
      uploadInProgressRef.current = false;
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const isSaveDisabled =
    !customLabel.trim() || (customMode === "color" ? !customColor.trim() : !customImageUrl.trim());

  const addTriggerLabel = /^colou?r$/i.test(optionTitle?.trim() ?? "")
    ? t("products.swatch.addColor")
    : /^pattern$/i.test(optionTitle?.trim() ?? "")
      ? t("products.swatch.addPattern")
      : t("products.swatch.addSwatch");
  const isColorAxis = !optionTitle || /^colou?r$/i.test(optionTitle.trim());

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        {label ? (
          <button
            className="inline-flex min-h-7 items-center gap-2 rounded-full px-2 text-xs font-medium hover:bg-accent"
            type="button"
          >
            {normalizedSwatch?.kind === "image" ? (
              <img
                alt=""
                aria-hidden="true"
                className="size-3.5 rounded-full object-cover border shadow-xs"
                src={normalizedSwatch.url}
              />
            ) : (
              <span
                aria-hidden="true"
                className="size-3.5 rounded-full border shadow-xs"
                style={{
                  backgroundColor:
                    normalizedSwatch?.kind === "color"
                      ? normalizedSwatch.value
                      : typeof value === "string" && value
                        ? value
                        : "transparent",
                }}
              />
            )}
            {label}
          </button>
        ) : (
          <Button className="rounded-full" size="sm" type="button" variant="outline">
            {addTriggerLabel}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="flex max-h-[calc(100dvh-2rem)] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl p-0 shadow-md ring-1 ring-foreground/10"
        collisionPadding={16}
        onKeyDown={(event) => event.stopPropagation()}
        sideOffset={6}
      >
        {step === "browse" ? (
          <Command
            className="flex max-h-[min(28rem,calc(100dvh-2rem))] flex-col rounded-none bg-transparent p-0"
            shouldFilter={false}
          >
            <div className="relative flex h-11 shrink-0 items-center justify-between border-b border-border/60 px-3.5">
              <span className="text-sm font-semibold">
                {isColorAxis
                  ? t("products.swatch.presetColors")
                  : t("products.swatch.presetSwatches")}
              </span>
              <button
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => setStep("custom")}
                type="button"
              >
                {t("products.swatch.customSwatch")}
              </button>
            </div>
            <CommandInput
              autoFocus
              onValueChange={setQuery}
              placeholder={
                isColorAxis ? t("products.swatch.searchColors") : t("products.swatch.searchPresets")
              }
              size="panel"
              value={query}
            />
            <CommandList
              className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-1"
              ref={listRef}
            >
              <CommandGroup>
                <CommandItem
                  className="mb-1 border border-dashed"
                  onSelect={() => setStep("custom")}
                  value="custom color or image swatch"
                >
                  <span className="grid size-6 place-items-center rounded-full border bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-medium">
                      {t("products.swatch.customSwatch")}
                    </strong>
                  </span>
                </CommandItem>
                {filtered.length ? (
                  filtered.map((item) => (
                    <CommandItem
                      key={item.value}
                      onSelect={() => {
                        onSave(item.label, { kind: "color", value: item.value.toLowerCase() });
                        close();
                      }}
                      value={`${item.label} ${item.value}`}
                    >
                      <span
                        className="size-5 rounded-full border shadow-xs"
                        style={{ backgroundColor: item.value }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground uppercase">
                        {item.value}
                      </span>
                    </CommandItem>
                  ))
                ) : (
                  <p className="px-2.5 py-6 text-center text-xs text-muted-foreground">
                    {t("products.swatch.noPreset")}
                  </p>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="flex min-h-0 flex-col">
            <div className="relative flex h-11 shrink-0 items-center border-b border-border/60 px-2">
              <button
                aria-label={t("products.swatch.backToPresets")}
                className="absolute left-1 z-10 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setStep("browse")}
                type="button"
              >
                <AppIcons.arrowLeft className="size-3.5" />
              </button>
              <p className="w-full truncate px-9 text-center text-sm font-medium">
                {t("products.swatch.customSwatch")}
              </p>
            </div>

            <div className="min-h-0 space-y-3.5 overflow-y-auto overscroll-contain p-3.5">
              <Field>
                <FieldLabel>{t("products.swatch.label")}</FieldLabel>
                <Input
                  autoFocus
                  onChange={(event) => setCustomLabel(event.currentTarget.value)}
                  placeholder={
                    customMode === "image"
                      ? t("products.swatch.swatchName")
                      : t("products.swatch.colorName")
                  }
                  value={customLabel}
                />
              </Field>

              <SegmentedControl
                active="muted"
                ariaLabel={t("products.swatch.swatchKind")}
                className="w-full"
                fullWidth
                onChange={(next) => setCustomMode(next as "color" | "image")}
                options={[
                  {
                    id: "color",
                    label: (
                      <span className="flex items-center justify-center gap-1.5 text-xs font-medium">
                        <AppIcons.editor className="size-3.5" />
                        <span>{t("products.swatch.color")}</span>
                      </span>
                    ),
                  },
                  {
                    id: "image",
                    label: (
                      <span className="flex items-center justify-center gap-1.5 text-xs font-medium">
                        <AppIcons.image className="size-3.5" />
                        <span>{t("products.swatch.image")}</span>
                      </span>
                    ),
                  },
                ]}
                size="sm"
                value={customMode}
              />

              {customMode === "color" ? (
                <ColorPickerField
                  label={t("products.swatch.swatch")}
                  onChange={setCustomColor}
                  value={customColor}
                />
              ) : (
                <div className="space-y-3">
                  <input
                    accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(event) => void handleFileUpload(event.target.files)}
                    ref={fileInputRef}
                    type="file"
                  />
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2.5">
                    <div className="size-12 shrink-0 overflow-hidden rounded-full border bg-muted shadow-xs grid place-items-center">
                      {customImageUrl.trim() ? (
                        <img
                          alt={t("products.swatch.preview")}
                          className="size-full object-cover"
                          src={customImageUrl.trim()}
                        />
                      ) : (
                        <AppIcons.image className="size-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground">
                        {customImageUrl.trim()
                          ? t("products.swatch.imageSelected")
                          : t("products.swatch.noImage")}
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {customImageUrl.trim()
                          ? t("products.swatch.imageUsedAsSwatch")
                          : t("products.swatch.imagePrompt")}
                      </p>
                      {customImageUrl.trim() ? (
                        <div className="mt-1 flex items-center gap-2">
                          <Button
                            className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setCustomImageUrl("")}
                            size="xs"
                            type="button"
                            variant="ghost"
                          >
                            <AppIcons.close className="size-3" />
                            {t("products.swatch.remove")}
                          </Button>
                          <Button
                            className="h-6 px-1.5 text-[11px]"
                            disabled={uploading}
                            onClick={openFilePicker}
                            size="xs"
                            type="button"
                            variant="ghost"
                          >
                            <AppIcons.upload className="size-3" />
                            {t("products.swatch.replace")}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {!customImageUrl.trim() ? (
                    <div className="flex flex-col gap-2 pt-1">
                      <Button
                        className="w-full justify-center"
                        disabled={uploading}
                        onClick={openFilePicker}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {uploading ? (
                          <AppIcons.loader className="size-3.5 animate-spin" />
                        ) : (
                          <AppIcons.upload className="size-3.5" />
                        )}
                        {uploading
                          ? t("products.swatch.uploadingImage")
                          : t("products.swatch.uploadImage")}
                      </Button>
                      <MediaLibraryDialog
                        onSelect={(assets) => {
                          const url = assets[0]?.publicUrl?.trim();
                          if (url) {
                            setCustomImageUrl(url);
                            if (!customLabel.trim() && assets[0]?.altText) {
                              setCustomLabel(assets[0].altText);
                            }
                          }
                        }}
                        selectionMode="single"
                        triggerClassName="w-full justify-center"
                        triggerLabel={t("products.swatch.chooseLibrary")}
                        triggerSize="sm"
                        triggerVariant="outline"
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex h-12 shrink-0 items-center justify-end gap-2 border-t border-border/60 bg-background px-3">
              <Button onClick={close} size="sm" type="button" variant="ghost">
                {t("products.swatch.cancel")}
              </Button>
              <Button
                disabled={isSaveDisabled || uploading}
                onClick={() => {
                  const swatch = buildProductOptionSwatch(customMode, customColor, customImageUrl);
                  onSave(customLabel.trim(), swatch);
                  close();
                }}
                size="sm"
                type="button"
              >
                {label ? t("products.swatch.saveSwatch") : t("products.swatch.addSwatchAction")}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
