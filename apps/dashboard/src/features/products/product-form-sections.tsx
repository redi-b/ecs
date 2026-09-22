"use client";

import type { ProductOptionMediaBindings, ProductOptionSwatch } from "@ecs/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { MediaUploadField } from "@/features/media/media-upload-field";
import {
  applyOptionMediaAutoAssignment,
  getRemovedExistingVariants,
  getVariantRows,
  normalizeProductOptions,
} from "@/features/products/product-form-state";
import type { ProductFormValues } from "@/features/products/product-form-types";
import { ProductOptionValuesField } from "@/features/products/product-option-values-field";
import type {
  ProductOptionDraft,
  VariantMatrixRow,
} from "@/features/products/product-variant-matrix";
import { ColorPickerField } from "@/features/storefront-editor/editor-theme";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { rankFuzzyItems } from "@/lib/fuzzy-search";
import { dashboardRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const COMMON_PRODUCT_COLORS = [
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

const COMMON_PRODUCT_COLOR_OPTIONS = COMMON_PRODUCT_COLORS.map(([label, value]) => ({
  label,
  value,
  keywords: `${label} ${value}`,
}));
const MAX_PRODUCT_VARIANTS = 100;

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

export function ProductReviewSummary({ values }: { values: ProductFormValues }) {
  const { t } = useI18n();
  const rows = getVariantRows(values);
  const normalizedOptions = normalizeProductOptions(values.options);
  const enabledRows = rows.filter((row) => row.enabled);
  const removedVariants = getRemovedExistingVariants(values);
  const totalStock = enabledRows.reduce((total, row) => total + row.stockedQuantity, 0);
  const prices = enabledRows.map((row) => row.priceAmount);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSummary = prices.length
    ? minPrice === maxPrice
      ? `ETB ${minPrice}`
      : `ETB ${minPrice} to ${maxPrice}`
    : "N/A";
  const reviewRows = [
    {
      label: t("products.formReview.title"),
      value: values.title.trim() || t("products.formReview.untitledProduct"),
    },
    {
      label: t("products.formReview.status"),
      value:
        values.status === "published"
          ? t("products.formReview.published")
          : t("products.formReview.draft"),
    },
    {
      label: t("products.formReview.price"),
      value: priceSummary,
    },
    {
      label: t("products.formReview.initialStock"),
      value: String(totalStock),
    },
    ...(values.hasVariants
      ? [
          {
            label: t("products.formReview.sellableRows"),
            value: String(enabledRows.length),
          },
        ]
      : []),
  ];

  return (
    <div className="grid gap-4">
      {removedVariants.length ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <p className="font-medium text-destructive">
            {t("products.formReview.removedVariants", { count: removedVariants.length })}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t("products.formReview.removedVariantsHelp")}
          </p>
        </div>
      ) : null}

      <dl className="divide-y rounded-xl border bg-background">
        {reviewRows.map((row) => (
          <div className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]" key={row.label}>
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="break-words text-sm font-medium">{row.value}</dd>
          </div>
        ))}
        {values.hasVariants && normalizedOptions.length ? (
          <div className="grid gap-3 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <dt className="text-sm text-muted-foreground">{t("products.formReview.options")}</dt>
            <dd className="grid min-w-0 gap-4">
              {normalizedOptions.map((option) => (
                <div className="grid gap-2" key={option.title}>
                  <p className="text-sm font-medium">{option.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {option.values.map((value) => (
                      <span
                        className="inline-flex max-w-full items-center gap-2 rounded-full border bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground"
                        key={value.id ?? value.label}
                      >
                        {value.swatch ? (
                          value.swatch.kind === "image" ? (
                            <img
                              alt=""
                              aria-hidden="true"
                              className="size-3.5 shrink-0 rounded-full border border-black/15 object-cover dark:border-white/20"
                              src={value.swatch.url}
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="size-3.5 shrink-0 rounded-full border border-black/15 dark:border-white/20"
                              style={{ backgroundColor: value.swatch.value }}
                            />
                          )
                        ) : null}
                        <span className="break-words">{value.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export function ProductOptionsBuilder({
  galleryImages,
  onChange,
  options,
}: {
  galleryImages?: string[] | undefined;
  onChange: (options: ProductOptionDraft[]) => void;
  options: ProductOptionDraft[];
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() || null;
  const optionSetsUrl = tenantId
    ? `/dashboard/products/actions/option-sets?tenantId=${encodeURIComponent(tenantId)}`
    : "/dashboard/products/actions/option-sets";
  const [draftValues, setDraftValues] = useState<Record<number, string>>({});
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const optionSetsQuery = useQuery({
    queryKey: ["product-option-sets", tenantId],
    queryFn: async () => {
      const response = await fetch(optionSetsUrl, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("option_sets_unavailable");
      return (await response.json()) as { optionSets: SavedProductOptionSet[] };
    },
    staleTime: 60_000,
  });
  const saveOptionSet = useMutation({
    mutationFn: async ({
      option,
      optionSetId,
    }: {
      option: ProductOptionDraft;
      optionIndex: number;
      optionSetId?: string | undefined;
    }) => {
      const actionUrl = optionSetId
        ? `/dashboard/products/actions/option-sets/${encodeURIComponent(optionSetId)}${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`
        : optionSetsUrl;
      const response = await fetch(actionUrl, {
        body: JSON.stringify({ title: option.title, values: option.values }),
        headers: { accept: "application/json", "content-type": "application/json" },
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        optionSet?: SavedProductOptionSet;
      };
      if (!response.ok) throw new Error(data.error ?? "option_set_save_failed");
      return data.optionSet;
    },
    onSuccess: async (savedOptionSet, variables) => {
      const savedOptionSetId = savedOptionSet?.id ?? variables.optionSetId;
      if (savedOptionSetId) {
        onChange(
          options.map((option, optionIndex) =>
            optionIndex === variables.optionIndex
              ? {
                  ...option,
                  savedOptionSetId,
                  savedOptionSnapshot: getSavedOptionSnapshot(variables.option),
                }
              : option,
          ),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["product-option-sets", tenantId] });
      toast.success(
        t(
          variables.optionSetId
            ? "products.formReview.savedOptionUpdated"
            : "products.formReview.savedOptionCreated",
        ),
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message === "product_option_set_title_taken"
          ? t("products.formReview.savedOptionExists")
          : t("products.formReview.savedOptionFailed"),
      );
    },
  });

  function addOption(title = "") {
    if (title && options.some((option) => option.title.toLowerCase() === title.toLowerCase())) {
      setAddMenuOpen(false);
      return;
    }
    onChange([
      ...options,
      {
        key: createClientId("option"),
        title,
        values: [],
      },
    ]);
    setAddMenuOpen(false);
  }

  function addSavedOption(optionSet: SavedProductOptionSet) {
    const existingCombinations = options.reduce(
      (total, option) => total * Math.max(option.values.length, 1),
      1,
    );
    if (existingCombinations * optionSet.values.length > MAX_PRODUCT_VARIANTS) {
      toast.error(t("products.validation.variantLimit", { count: MAX_PRODUCT_VARIANTS }));
      return;
    }
    onChange([
      ...options,
      {
        key: createClientId("option"),
        savedOptionSetId: optionSet.id,
        savedOptionSnapshot: getSavedOptionSnapshot(optionSet),
        title: optionSet.title,
        values: optionSet.values.map((value) => ({
          key: createClientId("value"),
          label: value.label,
          ...(value.swatch ? { swatch: value.swatch } : {}),
        })),
      },
    ]);
    setAddMenuOpen(false);
  }

  function updateOption(index: number, nextOption: ProductOptionDraft) {
    const next = [...options];

    next[index] = nextOption;
    onChange(next);
  }

  function addValues(index: number, rawValue: string) {
    const values = rawValue
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (!values.length) {
      return;
    }

    const option = options[index];

    if (!option) {
      return;
    }

    const otherCombinations = options.reduce(
      (total, candidate, candidateIndex) =>
        candidateIndex === index ? total : total * Math.max(candidate.values.length, 1),
      1,
    );
    const availableSlots = Math.max(
      0,
      Math.floor(MAX_PRODUCT_VARIANTS / otherCombinations) - option.values.length,
    );
    const uniqueValues = values.filter(
      (label, valueIndex) =>
        values.findIndex(
          (candidate) => candidate.toLocaleLowerCase() === label.toLocaleLowerCase(),
        ) === valueIndex &&
        !option.values.some(
          (value) => value.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
        ),
    );
    const acceptedValues = uniqueValues.slice(0, availableSlots);
    if (acceptedValues.length < uniqueValues.length) {
      toast.error(t("products.validation.variantLimit", { count: MAX_PRODUCT_VARIANTS }));
    }

    updateOption(index, {
      ...option,
      values: [
        ...option.values,
        ...acceptedValues.map((label) => ({ key: createClientId("value"), label })),
      ],
    });
    setDraftValues((current) => ({ ...current, [index]: "" }));
  }

  function removeValue(index: number, valueIndex: number) {
    const option = options[index];

    if (!option) {
      return;
    }

    updateOption(index, {
      ...option,
      values: option.values.filter((_, index) => index !== valueIndex),
    });
  }

  function updateColorValue(
    index: number,
    valueIndex: number,
    label: string,
    swatch: ProductOptionSwatch | string,
  ) {
    const option = options[index];
    if (!option) return;
    const normalizedSwatch = normalizeProductOptionSwatch(swatch) ?? {
      kind: "color" as const,
      value: typeof swatch === "string" ? swatch.toLowerCase() : "#808080",
    };
    updateOption(index, {
      ...option,
      values: option.values.map((value, candidateIndex) =>
        candidateIndex === valueIndex
          ? {
              ...value,
              // Medusa updates option values by label, not value ID. Keep our client key
              // stable, but let the presentation hook resolve the newly labelled value.
              id: undefined,
              label,
              swatch: normalizedSwatch,
            }
          : value,
      ),
    });
  }

  function addColorValue(index: number, label: string, swatch: ProductOptionSwatch | string) {
    const option = options[index];
    if (!option) return;
    if (option.values.some((item) => item.label.toLowerCase() === label.toLowerCase())) return;
    const otherCombinations = options.reduce(
      (total, candidate, candidateIndex) =>
        candidateIndex === index ? total : total * Math.max(candidate.values.length, 1),
      1,
    );
    if ((option.values.length + 1) * otherCombinations > MAX_PRODUCT_VARIANTS) {
      toast.error(t("products.validation.variantLimit", { count: MAX_PRODUCT_VARIANTS }));
      return;
    }
    const normalizedSwatch = normalizeProductOptionSwatch(swatch) ?? {
      kind: "color" as const,
      value: typeof swatch === "string" ? swatch.toLowerCase() : "#808080",
    };
    updateOption(index, {
      ...option,
      values: [
        ...option.values,
        {
          key: createClientId("value"),
          label,
          swatch: normalizedSwatch,
        },
      ],
    });
  }

  const presetOptions = [
    t("products.formReview.placeholderSize"),
    t("products.formReview.placeholderColor"),
    t("products.formReview.placeholderMaterial"),
    t("products.formReview.placeholderStyle"),
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">{t("products.formReview.optionsTitle")}</h3>
        <Popover onOpenChange={setAddMenuOpen} open={addMenuOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" type="button" variant="outline">
              {t("products.formReview.addOption")}
              <AppIcons.arrowDown data-icon="inline-end" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(18rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0"
          >
            <div className="shrink-0 border-b px-3 py-2.5 text-xs font-medium text-muted-foreground">
              {t("products.formReview.chooseOptionType")}
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-1.5">
              {presetOptions.map((preset) => (
                <button
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={options.some(
                    (option) => option.title.toLowerCase() === preset.toLowerCase(),
                  )}
                  key={preset}
                  onClick={() => addOption(preset)}
                  type="button"
                >
                  <span>{preset}</span>
                </button>
              ))}
              {optionSetsQuery.data?.optionSets.length ? (
                <>
                  <div className="my-1 border-t" />
                  <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    {t("products.formReview.savedOptions")}
                  </div>
                  {optionSetsQuery.data.optionSets.map((optionSet) => (
                    <button
                      className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={options.some(
                        (option) => option.title.toLowerCase() === optionSet.title.toLowerCase(),
                      )}
                      key={optionSet.id}
                      onClick={() => addSavedOption(optionSet)}
                      type="button"
                    >
                      <span>{optionSet.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {t("products.formReview.valuesCount", { count: optionSet.values.length })}
                      </span>
                    </button>
                  ))}
                </>
              ) : null}
              {optionSetsQuery.isPending ? (
                <div className="px-2.5 py-2 text-xs text-muted-foreground">
                  {t("products.formReview.loadingSavedOptions")}
                </div>
              ) : null}
              {optionSetsQuery.isError ? (
                <button
                  className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => void optionSetsQuery.refetch()}
                  type="button"
                >
                  {t("products.formReview.retrySavedOptions")}
                </button>
              ) : null}
              <div className="my-1 border-t" />
              <button
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent"
                onClick={() => addOption()}
                type="button"
              >
                {t("products.formReview.customOption")}
              </button>
            </div>
            <div className="shrink-0 border-t p-1.5">
              <Button asChild className="w-full justify-start" size="sm" variant="ghost">
                <Link href={getTenantScopedPath(dashboardRoutes.productOptions, tenantId)}>
                  <AppIcons.settings data-icon="inline-start" />
                  {t("products.formReview.manageSavedOptions")}
                </Link>
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {options.length ? (
        <div className="flex flex-col gap-3">
          {options.map((option, index) => (
            <div
              className="grid gap-3 rounded-xl border bg-background p-3 md:grid-cols-[12rem_minmax(0,1fr)]"
              key={option.id ?? option.key ?? index}
            >
              <Field>
                <FieldLabel>{t("products.formReview.optionName")}</FieldLabel>
                <Input
                  autoFocus={!option.title}
                  onChange={(event) =>
                    updateOption(index, { ...option, title: event.target.value })
                  }
                  placeholder={t("products.formReview.customOptionPlaceholder")}
                  value={option.title}
                />
              </Field>

              <Field>
                <FieldLabel>{t("products.formReview.values")}</FieldLabel>
                <ProductOptionValuesField
                  addControl={
                    isVisualOptionTitle(option.title) ? (
                      <ProductColorPopover
                        galleryImages={galleryImages}
                        onSave={(label, swatch) => addColorValue(index, label, swatch)}
                      />
                    ) : undefined
                  }
                  addLabel={t("products.formReview.addValue")}
                  inputLabel={t("products.formReview.addValueAria", {
                    option: option.title || t("products.formReview.optionFallback"),
                  })}
                  onChange={(value) =>
                    setDraftValues((current) => ({ ...current, [index]: value }))
                  }
                  onCommit={() => addValues(index, draftValues[index] ?? "")}
                  onPasteMany={(value) => addValues(index, value)}
                  onRemoveLast={
                    option.values.length
                      ? () => removeValue(index, option.values.length - 1)
                      : undefined
                  }
                  placeholder={
                    option.values.length
                      ? t("products.formReview.addAnotherValue")
                      : option.title.trim()
                        ? `Add ${option.title.toLowerCase()} values`
                        : t("products.formReview.valuePlaceholder")
                  }
                  value={draftValues[index] ?? ""}
                >
                  {option.values.map((value, valueIndex) => (
                    <span
                      className="inline-flex h-7 items-center rounded-full border border-border bg-secondary text-xs font-medium text-secondary-foreground"
                      key={value.id ?? `${value.label}-${valueIndex}`}
                    >
                      {isVisualOptionTitle(option.title) ? (
                        <ProductColorPopover
                          galleryImages={galleryImages}
                          label={value.label}
                          onSave={(label, swatch) =>
                            updateColorValue(index, valueIndex, label, swatch)
                          }
                          value={value.swatch ?? undefined}
                        />
                      ) : (
                        <span className="px-2">{value.label}</span>
                      )}
                      <button
                        aria-label={t("products.formReview.removeValueAria", {
                          value: value.label,
                        })}
                        className="mr-1 grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        onClick={() => removeValue(index, valueIndex)}
                        type="button"
                      >
                        <AppIcons.close className="size-3" />
                      </button>
                    </span>
                  ))}
                </ProductOptionValuesField>
                <FieldDescription>{t("products.formReview.valuesHelpShort")}</FieldDescription>
                {!/^(colou?r)$/i.test(option.title.trim()) ? (
                  <SuggestedOptionValues
                    existing={option.values.map((value) => value.label)}
                    onAdd={(label) => addValues(index, label)}
                    suggestions={
                      option.title.toLowerCase() ===
                      t("products.formReview.placeholderSize").toLowerCase()
                        ? ["XS", "S", "M", "L", "XL", "XXL"]
                        : option.title.toLowerCase() ===
                            t("products.formReview.placeholderMaterial").toLowerCase()
                          ? ["Cotton", "Leather", "Polyester"]
                          : option.title.toLowerCase() ===
                              t("products.formReview.placeholderStyle").toLowerCase()
                            ? ["Regular", "Slim", "Oversized"]
                            : []
                    }
                  />
                ) : null}
              </Field>

              <div className="flex flex-wrap items-center justify-end gap-2 md:col-span-2">
                <Button
                  disabled={
                    !option.title.trim() ||
                    !option.values.length ||
                    saveOptionSet.isPending ||
                    isSavedOptionUnchanged(option)
                  }
                  onClick={() =>
                    saveOptionSet.mutate({
                      option,
                      optionIndex: index,
                      optionSetId: option.savedOptionSetId,
                    })
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {isSavedOptionUnchanged(option)
                    ? t("products.formReview.savedForReuse")
                    : option.savedOptionSetId
                      ? t("products.formReview.updateSavedOption")
                      : t("products.formReview.saveForReuse")}
                </Button>
                <Button
                  aria-label={t("products.formReview.removeOptionAria", { option: option.title })}
                  onClick={() =>
                    onChange(options.filter((_, optionIndex) => optionIndex !== index))
                  }
                  size="icon-sm"
                  type="button"
                  variant="destructive"
                >
                  <AppIcons.trash />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <button
          className="rounded-xl border border-dashed bg-background px-4 py-5 text-left hover:bg-muted/20"
          onClick={() => setAddMenuOpen(true)}
          type="button"
        >
          <p className="text-sm font-medium">{t("products.formReview.noOptionsYet")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("products.formReview.noOptionsYetShort")}
          </p>
        </button>
      )}
    </div>
  );
}

type SavedProductOptionSet = {
  id: string;
  title: string;
  values: Array<ProductOptionDraft["values"][number]>;
};

function getSavedOptionSnapshot(option: Pick<ProductOptionDraft, "title" | "values">) {
  return JSON.stringify({
    title: option.title.trim(),
    values: option.values.map((value) => ({
      label: value.label.trim(),
      swatch: serializeProductOptionSwatch(value.swatch),
    })),
  });
}

function isSavedOptionUnchanged(option: ProductOptionDraft) {
  return (
    Boolean(option.savedOptionSetId) &&
    option.savedOptionSnapshot === getSavedOptionSnapshot(option)
  );
}

function SuggestedOptionValues({
  existing,
  onAdd,
  suggestions,
}: {
  existing: string[];
  onAdd: (value: string) => void;
  suggestions: string[];
}) {
  const remaining = suggestions.filter(
    (suggestion) => !existing.some((value) => value.toLowerCase() === suggestion.toLowerCase()),
  );
  if (!remaining.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {remaining.map((suggestion) => (
        <button
          className="rounded-full border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          key={suggestion}
          onClick={() => onAdd(suggestion)}
          type="button"
        >
          + {suggestion}
        </button>
      ))}
    </div>
  );
}

export function isVisualOptionTitle(title: string) {
  return /^(colou?r|pattern|fabric|material|texture|finish)$/i.test(title.trim());
}
export const isColorOptionTitle = isVisualOptionTitle;

export function VariantImagePicker({
  galleryImages = [],
  imageUrl,
  onRemoveImage,
  onSelectImage,
}: {
  galleryImages?: string[] | undefined;
  imageUrl?: string | undefined;
  onRemoveImage: () => void;
  onSelectImage: (url: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label={imageUrl ? "Change variant image" : "Select variant image"}
          className="group relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg transition-transform active:scale-95"
          onClick={(event) => event.stopPropagation()}
          type="button"
        >
          {imageUrl ? (
            /* biome-ignore lint/performance/noImgElement: Runtime product photo */
            <img alt="" className="size-9 rounded-lg object-cover border" src={imageUrl} />
          ) : (
            <div className="size-9 rounded-lg border border-dashed grid place-items-center text-muted-foreground hover:bg-muted">
              <AppIcons.image className="size-4" />
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3 text-xs" side="bottom">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">Variant Image</span>
            {imageUrl ? (
              <Button
                className="h-6 gap-1 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  onRemoveImage();
                  setOpen(false);
                }}
                size="xs"
                type="button"
                variant="ghost"
              >
                <AppIcons.close className="size-3" />
                Remove
              </Button>
            ) : null}
          </div>

          {galleryImages.length === 0 ? (
            <p className="py-3 text-center text-xs text-muted-foreground">
              No product images yet. Upload images in the Media section first.
            </p>
          ) : (
            <div className="grid max-h-48 grid-cols-4 gap-2 overflow-y-auto p-0.5">
              {galleryImages.map((url) => {
                const isSelected = imageUrl === url;
                return (
                  <button
                    className={cn(
                      "relative aspect-square w-full cursor-pointer overflow-hidden rounded-md border transition-all hover:scale-105 active:scale-95",
                      isSelected
                        ? "border-primary ring-2 ring-primary ring-offset-1"
                        : "border-border hover:border-foreground/40",
                    )}
                    key={url}
                    onClick={() => {
                      onSelectImage(url);
                      setOpen(false);
                    }}
                    type="button"
                  >
                    {/* biome-ignore lint/performance/noImgElement: Runtime asset */}
                    <img alt="" className="size-full object-cover" src={url} />
                    {isSelected ? (
                      <span className="absolute inset-0 grid place-items-center bg-primary/25 text-primary-foreground">
                        <AppIcons.check className="size-3.5 rounded-full bg-primary p-0.5 text-primary-foreground" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VariantMatrixTable({
  galleryImages,
  onApplyDefaults,
  onOverrideChange,
  rows,
  values,
}: {
  galleryImages?: string[] | undefined;
  onApplyDefaults: () => void;
  onOverrideChange: (
    key: string,
    override: {
      enabled?: boolean | undefined;
      imageUrl?: string | undefined;
      priceAmount?: string | undefined;
      sku?: string | undefined;
      stockedQuantity?: string | undefined;
    },
  ) => void;
  rows: VariantMatrixRow[];
  values: ProductFormValues["variantOverrides"];
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-medium">{t("products.formReview.matrixTitle")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("products.formReview.generatedCount", { count: rows.length })}
            </p>
          </div>
          <Button onClick={onApplyDefaults} size="sm" type="button" variant="outline">
            {t("products.formReview.applyDefaults")}
          </Button>
        </div>
        <div className="divide-y md:hidden">
          {rows.map((row) => {
            const override = values[row.key] ?? {};
            const name =
              Object.values(row.optionValues).join(" / ") ||
              t("products.formReview.defaultVariant");

            return (
              <Collapsible className="group px-3 py-2.5" key={row.key}>
                <div className="flex w-full items-center gap-2">
                  <Checkbox
                    aria-label={t("products.formReview.toggleVariantAria", { variant: name })}
                    checked={row.enabled}
                    disabled={row.reservedQuantity > 0}
                    onCheckedChange={(checked) =>
                      onOverrideChange(row.key, { enabled: checked === true })
                    }
                  />
                  <div className="shrink-0">
                    <VariantImagePicker
                      galleryImages={galleryImages}
                      imageUrl={override.imageUrl ?? row.imageUrl}
                      onRemoveImage={() => onOverrideChange(row.key, { imageUrl: undefined })}
                      onSelectImage={(url) => onOverrideChange(row.key, { imageUrl: url })}
                    />
                  </div>
                  <CollapsibleTrigger className="flex min-w-0 flex-1 cursor-pointer list-none items-center gap-2 text-left">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      ETB {override.priceAmount ?? row.priceAmount}
                    </span>
                    <AppIcons.arrowDown className="size-4 shrink-0 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="grid gap-3 pt-3 sm:grid-cols-2">
                    <Field>
                      <FieldLabel>{t("products.formReview.colPrice")}</FieldLabel>
                      <InputGroup>
                        <InputGroupAddon>ETB</InputGroupAddon>
                        <InputGroupInput
                          disabled={!row.enabled}
                          inputMode="numeric"
                          min="0"
                          onChange={(event) =>
                            onOverrideChange(row.key, { priceAmount: event.target.value })
                          }
                          type="text"
                          value={override.priceAmount ?? String(row.priceAmount)}
                        />
                      </InputGroup>
                    </Field>
                    <Field>
                      <FieldLabel>{t("products.formReview.colStock")}</FieldLabel>
                      <Input
                        disabled={!row.enabled}
                        inputMode="numeric"
                        min="0"
                        onChange={(event) =>
                          onOverrideChange(row.key, { stockedQuantity: event.target.value })
                        }
                        type="text"
                        value={override.stockedQuantity ?? String(row.stockedQuantity)}
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel>{t("products.composer.fieldSkuOptional")}</FieldLabel>
                      <Input
                        disabled={!row.enabled}
                        onChange={(event) => onOverrideChange(row.key, { sku: event.target.value })}
                        value={override.sku ?? row.sku}
                      />
                    </Field>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="w-14 px-4 py-3 text-left font-medium">Image</th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("products.formReview.colVariant")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("products.formReview.colSku")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("products.formReview.colPrice")}
                </th>
                <th className="px-4 py-3 text-left font-medium">
                  {t("products.formReview.colStock")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const override = values[row.key] ?? {};

                return (
                  <tr
                    className={
                      row.enabled
                        ? "border-t align-top"
                        : "border-t bg-muted/20 align-top opacity-65"
                    }
                    key={row.key}
                  >
                    <td className="w-14 px-4 py-3">
                      <VariantImagePicker
                        galleryImages={galleryImages}
                        imageUrl={override.imageUrl ?? row.imageUrl}
                        onRemoveImage={() => onOverrideChange(row.key, { imageUrl: undefined })}
                        onSelectImage={(url) => onOverrideChange(row.key, { imageUrl: url })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="mb-2 flex items-center gap-2 font-medium">
                        <Checkbox
                          aria-label={t("products.formReview.toggleVariantAria", {
                            variant: Object.values(row.optionValues).join(" / "),
                          })}
                          checked={row.enabled}
                          disabled={row.reservedQuantity > 0}
                          onCheckedChange={(checked) =>
                            onOverrideChange(row.key, { enabled: checked === true })
                          }
                        />
                        <span>
                          {Object.values(row.optionValues).join(" / ") ||
                            t("products.formReview.defaultVariant")}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(row.optionValues).length ? (
                          Object.entries(row.optionValues).map(([title, value]) => (
                            <Badge
                              className="rounded-md"
                              key={`${title}:${value}`}
                              variant="secondary"
                            >
                              {title}: {value}
                            </Badge>
                          ))
                        ) : (
                          <Badge className="rounded-md" variant="secondary">
                            {t("products.formReview.noOptions")}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        aria-label={t("products.formReview.skuAria", { key: row.key })}
                        className="h-9"
                        disabled={!row.enabled}
                        onChange={(event) => onOverrideChange(row.key, { sku: event.target.value })}
                        value={override.sku ?? row.sku}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <InputGroup className="h-9">
                        <InputGroupAddon>ETB</InputGroupAddon>
                        <InputGroupInput
                          aria-label={t("products.formReview.priceAria", { key: row.key })}
                          disabled={!row.enabled}
                          inputMode="numeric"
                          min="0"
                          onChange={(event) =>
                            onOverrideChange(row.key, { priceAmount: event.target.value })
                          }
                          type="text"
                          value={override.priceAmount ?? String(row.priceAmount)}
                        />
                      </InputGroup>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        aria-label={t("products.formReview.stockAria", { key: row.key })}
                        className="h-9"
                        disabled={!row.enabled}
                        inputMode="numeric"
                        min="0"
                        onChange={(event) =>
                          onOverrideChange(row.key, { stockedQuantity: event.target.value })
                        }
                        type="text"
                        value={override.stockedQuantity ?? String(row.stockedQuantity)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ProductOptionsWorkspace({
  galleryImages,
  onApplyDefaults,
  onOptionsChange,
  onOverrideChange,
  options,
  rows,
  values,
}: {
  galleryImages?: string[] | undefined;
  onApplyDefaults: () => void;
  onOptionsChange: (options: ProductOptionDraft[]) => void;
  onOverrideChange: (
    key: string,
    override: {
      enabled?: boolean | undefined;
      imageUrl?: string | undefined;
      priceAmount?: string | undefined;
      sku?: string | undefined;
      stockedQuantity?: string | undefined;
    },
  ) => void;
  options: ProductOptionDraft[];
  rows: VariantMatrixRow[];
  values: ProductFormValues["variantOverrides"];
}) {
  const { t } = useI18n();
  const [view, setView] = useState<"options" | "variants">("options");

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <SegmentedControl
        active="muted"
        ariaLabel={t("products.formReview.workspaceViewAria")}
        className="w-full sm:w-fit"
        fullWidth
        onChange={setView}
        options={[
          { id: "options", label: t("products.formReview.optionsTitle") },
          { id: "variants", label: t("products.formReview.matrixTitle") },
        ]}
        value={view}
      />
      {view === "options" ? (
        <ProductOptionsBuilder
          galleryImages={galleryImages}
          onChange={onOptionsChange}
          options={options}
        />
      ) : (
        <VariantMatrixTable
          galleryImages={galleryImages}
          onApplyDefaults={onApplyDefaults}
          onOverrideChange={onOverrideChange}
          rows={rows}
          values={values}
        />
      )}
    </div>
  );
}

export function ProductMediaSection({
  imageUrls,
  onImageUrlsChange,
  onOptionMediaBindingsChange,
  onThumbnailChange,
  onVariantOverridesChange,
  optionMediaBindings,
  options,
  thumbnail,
  variantOverrides,
}: {
  imageUrls: string[];
  onImageUrlsChange: (urls: string[]) => void;
  onOptionMediaBindingsChange?: (bindings: ProductOptionMediaBindings | null) => void;
  onThumbnailChange: (url: string) => void;
  onVariantOverridesChange?: (overrides: ProductFormValues["variantOverrides"]) => void;
  optionMediaBindings?: ProductOptionMediaBindings | null | undefined;
  options?: ProductOptionDraft[] | undefined;
  thumbnail: string;
  variantOverrides?: ProductFormValues["variantOverrides"] | undefined;
}) {
  return (
    <MediaUploadField
      imageUrls={imageUrls}
      onImageUrlsChange={onImageUrlsChange}
      onOptionMediaBindingsChange={onOptionMediaBindingsChange}
      onThumbnailChange={onThumbnailChange}
      onVariantOverridesChange={onVariantOverridesChange}
      optionMediaBindings={optionMediaBindings}
      options={options}
      thumbnail={thumbnail}
      variantOverrides={variantOverrides}
    />
  );
}
