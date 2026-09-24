"use client";

import type { ProductOptionSwatch } from "@ecs/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { AppIcons } from "@/components/app/icons";
import Link from "@/components/app/link";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ProductOptionValuesField } from "@/features/products/product-option-values-field";
import {
  isVisualOptionTitle,
  normalizeProductOptionSwatch,
  ProductColorPopover,
  serializeProductOptionSwatch,
} from "@/features/products/product-swatch-popover";
import type { ProductOptionDraft } from "@/features/products/product-variant-matrix";
import { useI18n } from "@/i18n/provider";
import { createClientId } from "@/lib/client-id";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

export const MAX_PRODUCT_VARIANTS = 100;
function getOptionDisplayMode(option: ProductOptionDraft): "text" | "swatch" {
  return option.displayMode ?? (isVisualOptionTitle(option.title) ? "swatch" : "text");
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
        body: JSON.stringify({
          title: option.title,
          values: option.values.map((value) => ({
            ...value,
            displayMode: getOptionDisplayMode(option),
          })),
        }),
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
        displayMode: optionSet.values[0]?.displayMode,
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
  function setOptionDisplayMode(index: number, displayMode: "text" | "swatch") {
    const option = options[index];
    if (!option) return;
    updateOption(index, { ...option, displayMode });
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
      <div className="sticky top-0 z-20 -mx-1 flex items-center justify-between gap-3 border-b bg-background px-1 pb-3 pt-1">
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
            className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-0 overflow-hidden p-0"
          >
            <div className="flex h-10 shrink-0 items-center border-b px-3 text-sm font-medium">
              {t("products.formReview.chooseOptionType")}
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-1">
              {presetOptions.map((preset) => (
                <button
                  className="flex min-h-8 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
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
                  <div className="my-0.5 border-t" />
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    {t("products.formReview.savedOptions")}
                  </div>
                  {optionSetsQuery.data.optionSets.map((optionSet) => (
                    <button
                      className="flex min-h-8 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-45"
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
              <div className="my-0.5 border-t" />
              <button
                className="min-h-8 w-full rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => addOption()}
                type="button"
              >
                {t("products.formReview.customOption")}
              </button>
            </div>
            <div className="shrink-0 border-t p-1">
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
              className="grid gap-3 rounded-xl border bg-background p-3 md:grid-cols-[13rem_minmax(0,1fr)]"
              key={option.id ?? option.key ?? index}
            >
              <div className="grid content-start gap-3">
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
                  <FieldLabel>{t("products.formReview.optionDisplay")}</FieldLabel>
                  <SegmentedControl
                    active="muted"
                    ariaLabel={t("products.formReview.optionDisplay")}
                    fullWidth
                    onChange={(value) => setOptionDisplayMode(index, value as "text" | "swatch")}
                    options={[
                      { id: "text", label: t("products.formReview.optionDisplayText") },
                      { id: "swatch", label: t("products.formReview.optionDisplaySwatch") },
                    ]}
                    size="sm"
                    value={getOptionDisplayMode(option)}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>{t("products.formReview.values")}</FieldLabel>
                <ProductOptionValuesField
                  addControl={
                    getOptionDisplayMode(option) === "swatch" ? (
                      <ProductColorPopover
                        galleryImages={galleryImages}
                        onSave={(label, swatch) => addColorValue(index, label, swatch)}
                        optionTitle={option.title}
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
                      {getOptionDisplayMode(option) === "swatch" ? (
                        <ProductColorPopover
                          galleryImages={galleryImages}
                          label={value.label}
                          onSave={(label, swatch) =>
                            updateColorValue(index, valueIndex, label, swatch)
                          }
                          optionTitle={option.title}
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
  values: Array<
    ProductOptionDraft["values"][number] & { displayMode?: "text" | "swatch" | undefined }
  >;
};

function getSavedOptionSnapshot(
  option: Pick<ProductOptionDraft, "displayMode" | "title"> & {
    values: Array<
      ProductOptionDraft["values"][number] & { displayMode?: "text" | "swatch" | undefined }
    >;
  },
) {
  const displayMode =
    option.displayMode ??
    option.values[0]?.displayMode ??
    (isVisualOptionTitle(option.title) ? "swatch" : "text");
  return JSON.stringify({
    displayMode,
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
