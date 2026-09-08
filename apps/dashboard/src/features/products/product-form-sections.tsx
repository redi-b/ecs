"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getRemovedExistingVariants,
  getVariantRows,
  normalizeProductOptions,
} from "@/features/products/product-form-state";
import type { ProductFormValues } from "@/features/products/product-form-types";
import type {
  ProductOptionDraft,
  VariantMatrixRow,
} from "@/features/products/product-variant-matrix";
import { ColorPickerField } from "@/features/storefront-editor/editor-theme";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

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

export function ProductColorPopover({
  label,
  onSave,
  value,
}: {
  label?: string;
  onSave: (label: string, value: string) => void;
  value?: string;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"browse" | "custom">("browse");
  const [query, setQuery] = useState("");
  const [customLabel, setCustomLabel] = useState(label ?? "");
  const [customValue, setCustomValue] = useState(value ?? "#808080");
  const filtered = COMMON_PRODUCT_COLOR_OPTIONS.filter((item) =>
    item.keywords.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function close() {
    setOpen(false);
    setQuery("");
    setStep("browse");
  }

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setCustomLabel(label ?? "");
          setCustomValue(value ?? "#808080");
        } else {
          setQuery("");
          setStep("browse");
        }
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        {label ? (
          <button
            className="inline-flex min-h-7 items-center gap-2 rounded-full px-2 text-xs font-medium hover:bg-accent"
            type="button"
          >
            <span
              className="size-3.5 rounded-full border shadow-xs"
              style={{ backgroundColor: value ?? "transparent" }}
            />
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
        className="w-80 p-0"
        onKeyDown={(event) => event.stopPropagation()}
      >
        {step === "browse" ? (
          <div className="flex flex-col">
            <div className="border-b p-3">
              <div className="text-sm font-medium">Choose a color</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Select a common color or create an exact custom swatch.
              </p>
            </div>
            <div className="p-2">
              <Input
                autoFocus
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Search colors…"
                value={query}
              />
            </div>
            <div className="max-h-64 overflow-y-auto overscroll-contain p-2 pt-0">
              <button
                className="mb-1 flex w-full items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-left hover:bg-accent"
                onClick={() => setStep("custom")}
                type="button"
              >
                <span className="grid size-7 place-items-center rounded-full border bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)]" />
                <span>
                  <strong className="block text-sm">Custom color</strong>
                  <small className="text-xs text-muted-foreground">
                    Choose a precise color and label
                  </small>
                </span>
              </button>
              {filtered.length ? (
                filtered.map((item) => (
                  <button
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-accent"
                    key={item.value}
                    onClick={() => {
                      onSave(item.label, item.value);
                      close();
                    }}
                    type="button"
                  >
                    <span
                      className="size-6 rounded-full border shadow-xs"
                      style={{ backgroundColor: item.value }}
                    />
                    <span className="flex-1 text-sm">{item.label}</span>
                    <span className="font-mono text-xs text-muted-foreground uppercase">
                      {item.value}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">
                  No preset matches. Choose Custom color above.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            <div className="relative flex h-8 items-center border-b border-border/60 px-1">
              <button
                aria-label="Back to common colors"
                className="absolute left-1 z-10 grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setStep("browse")}
                type="button"
              >
                <AppIcons.arrowLeft className="size-3.5" />
              </button>
              <p className="w-full truncate px-9 text-center text-xs font-medium">Custom color</p>
            </div>
            <Field>
              <FieldLabel>Label</FieldLabel>
              <Input
                autoFocus
                onChange={(event) => setCustomLabel(event.currentTarget.value)}
                placeholder="e.g. Ocean blue"
                value={customLabel}
              />
            </Field>
            <ColorPickerField label="Swatch" onChange={setCustomValue} value={customValue} />
            <div className="flex justify-end gap-2">
              <Button onClick={close} size="sm" type="button" variant="ghost">
                Cancel
              </Button>
              <Button
                disabled={!customLabel.trim()}
                onClick={() => {
                  onSave(customLabel.trim(), customValue);
                  close();
                }}
                size="sm"
                type="button"
              >
                {label ? "Save color" : "Add color"}
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
    : "—";
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
            label: t("products.formReview.options"),
            value: normalizedOptions
              .map(
                (option) =>
                  `${option.title}: ${option.values.map((value) => value.label).join(", ")}`,
              )
              .join(" · "),
          },
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
      </dl>
    </div>
  );
}

export function ProductOptionsBuilder({
  onChange,
  options,
}: {
  onChange: (options: ProductOptionDraft[]) => void;
  options: ProductOptionDraft[];
}) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId")?.trim() || null;
  const optionSetsUrl = tenantId
    ? `/admin/products/actions/option-sets?tenantId=${encodeURIComponent(tenantId)}`
    : "/admin/products/actions/option-sets";
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
        ? `/admin/products/actions/option-sets/${encodeURIComponent(optionSetId)}${tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : ""}`
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

  function updateColorValue(index: number, valueIndex: number, label: string, color: string) {
    const option = options[index];
    if (!option) return;
    updateOption(index, {
      ...option,
      values: option.values.map((value, index) =>
        index === valueIndex
          ? {
              ...value,
              // Medusa updates option values by label, not value ID. Keep our client key
              // stable, but let the presentation hook resolve the newly labelled value.
              id: undefined,
              label,
              swatch: { kind: "color" as const, value: color.toLowerCase() },
            }
          : value,
      ),
    });
  }

  function addColorValue(index: number, label: string, color: string) {
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
    updateOption(index, {
      ...option,
      values: [
        ...option.values,
        {
          key: createClientId("value"),
          label,
          swatch: { kind: "color", value: color.toLowerCase() },
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
          <PopoverContent align="end" className="w-72 p-1.5">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              {t("products.formReview.chooseOptionType")}
            </div>
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
            <div className="my-1 border-t" />
            <Button asChild className="w-full justify-start" size="sm" variant="ghost">
              <Link href={getTenantScopedPath(dashboardRoutes.productOptions, tenantId)}>
                <AppIcons.settings data-icon="inline-start" />
                {t("products.formReview.manageSavedOptions")}
              </Link>
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      {options.length ? (
        <div className="divide-y rounded-xl border bg-background">
          {options.map((option, index) => (
            <div
              className="grid gap-3 p-3 md:grid-cols-[11rem_minmax(0,1fr)_auto] md:items-start"
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
                <div className="flex max-h-36 min-h-9 flex-wrap items-center gap-1.5 overflow-y-auto overscroll-contain rounded-xl border bg-muted/15 px-2 py-1.5">
                  {option.values.map((value, valueIndex) => (
                    <span
                      className="inline-flex h-7 items-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
                      key={value.id ?? `${value.label}-${valueIndex}`}
                    >
                      {isColorOptionTitle(option.title) ? (
                        <ProductColorPopover
                          label={value.label}
                          onSave={(label, color) =>
                            updateColorValue(index, valueIndex, label, color)
                          }
                          value={value.swatch?.value ?? "#808080"}
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
                  {!isColorOptionTitle(option.title) ? (
                    <input
                      aria-label={t("products.formReview.addValueAria", {
                        option: option.title || t("products.formReview.optionFallback"),
                      })}
                      className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground"
                      onChange={(event) =>
                        setDraftValues((current) => ({
                          ...current,
                          [index]: event.target.value,
                        }))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === ",") {
                          event.preventDefault();
                          addValues(index, draftValues[index] ?? "");
                        }
                      }}
                      onPaste={(event) => {
                        const pastedText = event.clipboardData.getData("text");

                        if (/[\n,]/.test(pastedText)) {
                          event.preventDefault();
                          addValues(index, pastedText);
                        }
                      }}
                      placeholder={
                        option.values.length
                          ? t("products.formReview.addAnotherValue")
                          : option.title.trim()
                            ? `Add ${option.title.toLowerCase()} values`
                            : t("products.formReview.valuePlaceholder")
                      }
                      value={draftValues[index] ?? ""}
                    />
                  ) : (
                    <ProductColorPopover
                      onSave={(label, color) => addColorValue(index, label, color)}
                    />
                  )}
                </div>
                <FieldDescription>{t("products.formReview.valuesHelpShort")}</FieldDescription>
                {!isColorOptionTitle(option.title) ? (
                  <SuggestedOptionValues
                    existing={option.values.map((value) => value.label)}
                    onAdd={(label) => addValues(index, label)}
                    suggestions={
                      option.title.toLowerCase() ===
                      t("products.formReview.placeholderSize").toLowerCase()
                        ? ["Small", "Medium", "Large", "XL"]
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

              <div className="flex justify-end gap-1 md:mt-6">
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
                  variant="ghost"
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
                  variant="ghost"
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
      swatch: value.swatch?.value?.toLowerCase() ?? null,
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

function isColorOptionTitle(title: string) {
  return /^(colou?r)$/i.test(title.trim());
}

export function VariantMatrixTable({
  onApplyDefaults,
  onOverrideChange,
  rows,
  values,
}: {
  onApplyDefaults: () => void;
  onOverrideChange: (
    key: string,
    override: {
      enabled?: boolean | undefined;
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
              <details className="group px-3 py-2.5" key={row.key}>
                <summary className="flex cursor-pointer list-none items-center gap-2">
                  <Checkbox
                    aria-label={t("products.formReview.toggleVariantAria", { variant: name })}
                    checked={row.enabled}
                    disabled={row.reservedQuantity > 0}
                    onClick={(event) => event.stopPropagation()}
                    onCheckedChange={(checked) =>
                      onOverrideChange(row.key, { enabled: checked === true })
                    }
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                  <span className="text-xs text-muted-foreground">
                    ETB {override.priceAmount ?? row.priceAmount}
                  </span>
                  <AppIcons.arrowDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
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
              </details>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[46rem] text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
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
