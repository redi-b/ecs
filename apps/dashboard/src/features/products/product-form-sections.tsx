"use client";

import { useState } from "react";
import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatEtbAmount,
  getVariantRows,
  normalizeProductOptions,
  parseWholeNumber,
} from "@/features/products/product-form-state";
import type { ProductFormValues } from "@/features/products/product-form-types";
import type {
  ProductOptionDraft,
  VariantMatrixRow,
} from "@/features/products/product-variant-matrix";
import { ColorPickerField } from "@/features/storefront-editor/editor-theme";
import { useI18n } from "@/i18n/provider";

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

function ProductColorPopover({
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

export function SimpleProductStockPreview({ values }: { values: ProductFormValues }) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <VariantMatrixMetric
        label={t("products.formReview.productType")}
        value={t("products.formReview.simpleProduct")}
      />
      <VariantMatrixMetric
        label={t("products.formReview.price")}
        value={formatEtbAmount(values.priceAmount, t)}
      />
      <VariantMatrixMetric
        label={t("products.formReview.initialStock")}
        value={String(parseWholeNumber(values.initialStock) ?? 0)}
      />
    </div>
  );
}

export function ProductReviewSummary({ values }: { values: ProductFormValues }) {
  const { t } = useI18n();
  const rows = getVariantRows(values);
  const normalizedOptions = normalizeProductOptions(values.options);
  const totalStock = rows.reduce((total, row) => total + row.stockedQuantity, 0);
  const prices = rows.map((row) => row.priceAmount);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const overriddenRows = rows.filter((row) => values.variantOverrides[row.key]).length;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-4">
        <VariantMatrixMetric
          label={t("products.formReview.productType")}
          value={
            values.hasVariants
              ? t("products.formReview.variantProduct")
              : t("products.formReview.simpleProduct")
          }
        />
        <VariantMatrixMetric
          label={t("products.formReview.sellableRows")}
          value={String(rows.length)}
        />
        <VariantMatrixMetric
          label={t("products.formReview.price")}
          value={minPrice === maxPrice ? `ETB ${minPrice}` : `ETB ${minPrice} to ${maxPrice}`}
        />
        <VariantMatrixMetric
          label={t("products.formReview.initialStock")}
          value={String(totalStock)}
        />
      </div>

      <div className="rounded-2xl border bg-background p-4">
        <h3 className="text-sm font-medium">{t("products.formReview.whatWillBeSaved")}</h3>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <ReviewLine
            label={t("products.formReview.title")}
            value={values.title.trim() || t("products.formReview.untitledProduct")}
          />
          <ReviewLine
            label={t("products.formReview.status")}
            value={
              values.status === "published"
                ? t("products.formReview.published")
                : t("products.formReview.draft")
            }
          />
          <ReviewLine
            label={t("products.formReview.handle")}
            value={
              values.handle.trim() ? `/${values.handle.trim()}` : t("products.formReview.noHandle")
            }
          />
          <ReviewLine
            label={t("products.formReview.skuPrefix")}
            value={values.skuPrefix.trim() || t("products.formReview.noSkuPrefix")}
          />
          <ReviewLine
            label={t("products.formReview.options")}
            value={
              values.hasVariants && normalizedOptions.length
                ? normalizedOptions
                    .map(
                      (option) =>
                        `${option.title}: ${option.values.map((value) => value.label).join(", ")}`,
                    )
                    .join(" | ")
                : t("products.formReview.noShopperOptions")
            }
          />
          <ReviewLine
            label={t("products.formReview.overrides")}
            value={
              values.hasVariants
                ? overriddenRows === 1
                  ? t("products.formReview.rowCustomizedOne")
                  : t("products.formReview.rowsCustomized", { count: overriddenRows })
                : t("products.formReview.notApplicable")
            }
          />
        </div>
      </div>
    </div>
  );
}

export function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words font-medium">{value}</div>
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
  const [draftValues, setDraftValues] = useState<Record<number, string>>({});

  function addOption(title = "") {
    onChange([...options, { title, values: [] }]);
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

    updateOption(index, {
      ...option,
      values: [
        ...option.values,
        ...values
          .filter(
            (label) =>
              !option.values.some(
                (value) => value.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
              ),
          )
          .map((label) => ({ label })),
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
          ? { ...value, label, swatch: { kind: "color" as const, value: color.toLowerCase() } }
          : value,
      ),
    });
  }

  function addColorValue(index: number, label: string, color: string) {
    const option = options[index];
    if (!option) return;
    if (option.values.some((item) => item.label.toLowerCase() === label.toLowerCase())) return;
    updateOption(index, {
      ...option,
      values: [...option.values, { label, swatch: { kind: "color", value: color.toLowerCase() } }],
    });
  }

  const presetOptions = [
    t("products.formReview.placeholderSize"),
    t("products.formReview.placeholderColor"),
    t("products.formReview.placeholderMaterial"),
  ];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-sm font-medium">{t("products.formReview.optionsTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("products.formReview.optionsDesc")}</p>
        </div>
        <Button onClick={() => addOption()} size="sm" type="button" variant="outline">
          {t("products.formReview.addOption")}
        </Button>
      </div>

      {options.length ? (
        <div className="flex flex-col gap-3">
          {options.map((option, index) => (
            <div
              className="rounded-xl border bg-background p-4"
              key={
                // biome-ignore lint/suspicious/noArrayIndexKey: option order is the draft identity until the product is submitted.
                index
              }
            >
              <div className="grid gap-4 md:grid-cols-[14rem_minmax(0,1fr)_auto] md:items-start">
                <Field>
                  <FieldLabel>{t("products.formReview.optionName")}</FieldLabel>
                  <Input
                    onChange={(event) =>
                      updateOption(index, { ...option, title: event.target.value })
                    }
                    placeholder={
                      index === 0
                        ? t("products.formReview.placeholderSize")
                        : t("products.formReview.placeholderColor")
                    }
                    value={option.title}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("products.formReview.values")}</FieldLabel>
                  <div className="flex max-h-36 min-h-11 flex-wrap items-center gap-2 overflow-y-auto overscroll-contain rounded-full border bg-muted/20 px-2 py-1.5">
                    {option.values.map((value, valueIndex) => (
                      <span
                        className="inline-flex h-8 items-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground"
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
                  <FieldDescription>{t("products.formReview.valuesHelp")}</FieldDescription>
                </Field>

                <Button
                  className="md:mt-6"
                  onClick={() =>
                    onChange(options.filter((_, optionIndex) => optionIndex !== index))
                  }
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("products.formReview.remove")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-background px-4 py-5">
          <p className="text-sm font-medium">{t("products.formReview.noOptionsYet")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("products.formReview.noOptionsYetDesc")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {presetOptions.map((title) => (
              <Button
                key={title}
                onClick={() => addOption(title)}
                size="sm"
                type="button"
                variant="outline"
              >
                {t("products.formReview.addNamed", { title })}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function isColorOptionTitle(title: string) {
  return /^(colou?r)$/i.test(title.trim());
}

export function VariantMatrixTable({
  onOverrideChange,
  rows,
  values,
}: {
  onOverrideChange: (
    key: string,
    override: {
      priceAmount?: string | undefined;
      sku?: string | undefined;
      stockedQuantity?: string | undefined;
    },
  ) => void;
  rows: VariantMatrixRow[];
  values: ProductFormValues["variantOverrides"];
}) {
  const { t } = useI18n();
  const totalStock = rows.reduce((total, row) => total + row.stockedQuantity, 0);
  const prices = rows.map((row) => row.priceAmount);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSummary = minPrice === maxPrice ? `ETB ${minPrice}` : `ETB ${minPrice} to ${maxPrice}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <VariantMatrixMetric label={t("products.formReview.options")} value={String(rows.length)} />
        <VariantMatrixMetric
          label={t("products.formReview.totalStocked")}
          value={String(totalStock)}
        />
        <VariantMatrixMetric label={t("products.formReview.priceRange")} value={priceSummary} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="flex flex-col gap-1 border-b bg-muted/30 px-4 py-3">
          <h3 className="text-sm font-medium">{t("products.formReview.matrixTitle")}</h3>
          <p className="text-sm text-muted-foreground">{t("products.formReview.matrixDesc")}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
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
                  <tr className="border-t align-top" key={row.key}>
                    <td className="px-4 py-3">
                      <div className="mb-2 font-medium">
                        {Object.values(row.optionValues).join(" / ") ||
                          t("products.formReview.defaultVariant")}
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
                        onChange={(event) => onOverrideChange(row.key, { sku: event.target.value })}
                        value={override.sku ?? row.sku}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <InputGroup className="h-9">
                        <InputGroupAddon>ETB</InputGroupAddon>
                        <InputGroupInput
                          aria-label={t("products.formReview.priceAria", { key: row.key })}
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

export function VariantMatrixMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
