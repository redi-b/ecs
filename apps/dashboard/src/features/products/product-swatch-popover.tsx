"use client";

import type { ProductOptionSwatch } from "@ecs/contracts";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
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
import { ColorPickerField } from "@/features/storefront-editor/editor-theme";
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

export function isVisualOptionTitle(title: string) {
  return /^(colou?r|pattern|fabric|material|texture|finish)$/i.test(title.trim());
}
export const isColorOptionTitle = isVisualOptionTitle;

export function ProductColorPopover({
  galleryImages,
  label,
  onSave,
  value,
}: {
  galleryImages?: string[] | undefined;
  label?: string | undefined;
  onSave: (label: string, swatch: ProductOptionSwatch) => void;
  value?: ProductOptionSwatch | string | null | undefined;
}) {
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

  const isSaveDisabled =
    !customLabel.trim() || (customMode === "color" ? !customColor.trim() : !customImageUrl.trim());

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
            Add color
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-[var(--radix-popover-content-available-height)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain p-0"
        collisionPadding={16}
        onKeyDown={(event) => event.stopPropagation()}
        sideOffset={6}
      >
        {step === "browse" ? (
          <Command className="h-auto min-h-0 rounded-xl! p-0" shouldFilter={false}>
            <div className="border-b p-3">
              <div className="text-sm font-medium">Choose a color</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select a common color or create an exact custom swatch.
              </p>
            </div>
            <CommandInput
              autoFocus
              onValueChange={setQuery}
              placeholder="Search colors…"
              size="panel"
              value={query}
            />
            <CommandList
              className="min-h-0 max-h-[min(20rem,calc(var(--radix-popover-content-available-height)-8.5rem))] overscroll-contain p-1"
              ref={listRef}
            >
              <CommandGroup>
                <CommandItem
                  className="mb-1 border border-dashed"
                  onSelect={() => setStep("custom")}
                  value="custom color or fabric pattern"
                >
                  <span className="grid size-7 place-items-center rounded-full border bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-sm font-medium">
                      Custom color or fabric pattern...
                    </strong>
                    <small className="block truncate text-xs text-muted-foreground">
                      Choose a precise color or fabric pattern
                    </small>
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
                        className="size-6 rounded-full border shadow-xs"
                        style={{ backgroundColor: item.value }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                      <span className="font-mono text-xs text-muted-foreground uppercase">
                        {item.value}
                      </span>
                    </CommandItem>
                  ))
                ) : (
                  <p className="px-2.5 py-5 text-center text-sm text-muted-foreground">
                    No preset matches this search.
                  </p>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        ) : (
          <div className="flex max-h-[var(--radix-popover-content-available-height)] flex-col gap-3 overflow-y-auto overscroll-contain p-3">
            <div className="relative flex h-8 items-center border-b border-border/60 px-1">
              <button
                aria-label="Back to common colors"
                className="absolute left-1 z-10 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setStep("browse")}
                type="button"
              >
                <AppIcons.arrowLeft className="size-3.5" />
              </button>
              <p className="w-full truncate px-9 text-center text-xs font-medium">Custom swatch</p>
            </div>
            <Field>
              <FieldLabel>Label</FieldLabel>
              <Input
                autoFocus
                onChange={(event) => setCustomLabel(event.currentTarget.value)}
                placeholder={customMode === "image" ? "Pattern name" : "Color name"}
                value={customLabel}
              />
            </Field>

            <SegmentedControl
              active="muted"
              ariaLabel="Swatch kind"
              className="w-full"
              fullWidth
              onChange={(next) => setCustomMode(next as "color" | "image")}
              options={[
                { id: "color", label: "🎨 Color" },
                { id: "image", label: "🖼️ Fabric Pattern" },
              ]}
              size="sm"
              value={customMode}
            />

            {customMode === "color" ? (
              <ColorPickerField label="Swatch" onChange={setCustomColor} value={customColor} />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="size-12 rounded-full border shadow-xs object-cover overflow-hidden bg-muted grid place-items-center shrink-0">
                    {customImageUrl.trim() ? (
                      <img
                        alt="Pattern preview"
                        className="size-full object-cover"
                        src={customImageUrl.trim()}
                      />
                    ) : (
                      <AppIcons.image className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground">Pattern preview</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {customImageUrl.trim() ? "48px circular crop" : "Enter an image URL below"}
                    </div>
                  </div>
                </div>

                <Field>
                  <FieldLabel>Image URL</FieldLabel>
                  <Input
                    onChange={(event) => setCustomImageUrl(event.currentTarget.value)}
                    placeholder="https://example.com/fabric-texture.jpg"
                    type="url"
                    value={customImageUrl}
                  />
                </Field>

                {galleryImages && galleryImages.length > 0 ? (
                  <div className="space-y-1.5">
                    <FieldLabel className="text-xs text-muted-foreground">
                      Product images
                    </FieldLabel>
                    <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-md border bg-muted/20 p-1.5">
                      {galleryImages.map((url, idx) => (
                        <button
                          className={cn(
                            "relative size-9 shrink-0 overflow-hidden rounded-md border transition-all hover:ring-2 hover:ring-primary/50",
                            customImageUrl.trim() === url && "ring-2 ring-primary border-primary",
                          )}
                          key={`${url}-${idx}`}
                          onClick={() => setCustomImageUrl(url)}
                          type="button"
                        >
                          <img alt="" className="size-full object-cover" src={url} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2 border-t border-border/60 pt-3">
              <Button onClick={close} size="sm" type="button" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={isSaveDisabled}
                onClick={() => {
                  const swatch = buildProductOptionSwatch(customMode, customColor, customImageUrl);
                  onSave(customLabel.trim(), swatch);
                  close();
                }}
                size="sm"
                type="button"
              >
                {label ? "Save swatch" : "Add swatch"}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
