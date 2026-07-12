"use client";

import { useState } from "react";
import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
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

export function SimpleProductStockPreview({ values }: { values: ProductFormValues }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <VariantMatrixMetric label="Product type" value="Simple product" />
      <VariantMatrixMetric label="Price" value={formatEtbAmount(values.priceAmount)} />
      <VariantMatrixMetric
        label="Initial stock"
        value={String(parseWholeNumber(values.initialStock) ?? 0)}
      />
    </div>
  );
}

export function ProductReviewSummary({ values }: { values: ProductFormValues }) {
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
          label="Product type"
          value={values.hasVariants ? "Variant product" : "Simple product"}
        />
        <VariantMatrixMetric label="Sellable rows" value={String(rows.length)} />
        <VariantMatrixMetric
          label="Price"
          value={minPrice === maxPrice ? `ETB ${minPrice}` : `ETB ${minPrice} to ${maxPrice}`}
        />
        <VariantMatrixMetric label="Initial stock" value={String(totalStock)} />
      </div>

      <div className="rounded-2xl border bg-background p-4">
        <h3 className="text-sm font-medium">What will be saved</h3>
        <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
          <ReviewLine label="Title" value={values.title.trim() || "Untitled product"} />
          <ReviewLine
            label="Status"
            value={values.status === "published" ? "Published" : "Draft"}
          />
          <ReviewLine
            label="Handle"
            value={values.handle.trim() ? `/${values.handle.trim()}` : "No handle"}
          />
          <ReviewLine label="SKU prefix" value={values.skuPrefix.trim() || "No SKU prefix"} />
          <ReviewLine
            label="Options"
            value={
              values.hasVariants && normalizedOptions.length
                ? normalizedOptions
                    .map((option) => `${option.title}: ${option.values.join(", ")}`)
                    .join(" | ")
                : "No shopper options"
            }
          />
          <ReviewLine
            label="Overrides"
            value={
              values.hasVariants
                ? `${overriddenRows} row${overriddenRows === 1 ? "" : "s"} customized`
                : "Not applicable"
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
      values: [...new Set([...option.values, ...values])],
    });
    setDraftValues((current) => ({ ...current, [index]: "" }));
  }

  function removeValue(index: number, value: string) {
    const option = options[index];

    if (!option) {
      return;
    }

    updateOption(index, {
      ...option,
      values: option.values.filter((currentValue) => currentValue !== value),
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-muted/20 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="max-w-2xl">
          <h3 className="text-sm font-medium">Product options</h3>
          <p className="text-sm text-muted-foreground">
            Add the attributes shoppers choose from. Each value combination becomes a variant.
          </p>
        </div>
        <Button onClick={() => addOption()} size="sm" type="button" variant="outline">
          Add option
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
                  <FieldLabel>Option name</FieldLabel>
                  <Input
                    onChange={(event) =>
                      updateOption(index, { ...option, title: event.target.value })
                    }
                    placeholder={index === 0 ? "Size" : "Color"}
                    value={option.title}
                  />
                </Field>

                <Field>
                  <FieldLabel>Values</FieldLabel>
                  <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-2 py-2">
                    {option.values.map((value) => (
                      <Badge className="gap-1 rounded-md px-2 py-1" key={value} variant="secondary">
                        {value}
                        <button
                          aria-label={`Remove ${value}`}
                          className="ml-1 rounded-sm text-muted-foreground hover:text-foreground"
                          onClick={() => removeValue(index, value)}
                          type="button"
                        >
                          <AppIcons.close className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    <input
                      aria-label={`Add value for ${option.title || "option"}`}
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
                        option.values.length ? "Add another value" : "Small, Medium, Large"
                      }
                      value={draftValues[index] ?? ""}
                    />
                  </div>
                  <FieldDescription>
                    Press Enter or comma to add a value. Paste a comma-separated list to add many.
                  </FieldDescription>
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
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-background px-4 py-5">
          <p className="text-sm font-medium">No options yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a simple product, or add common option groups to generate a variant matrix.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {["Size", "Color", "Material"].map((title) => (
              <Button
                key={title}
                onClick={() => addOption(title)}
                size="sm"
                type="button"
                variant="outline"
              >
                Add {title}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
  const totalStock = rows.reduce((total, row) => total + row.stockedQuantity, 0);
  const prices = rows.map((row) => row.priceAmount);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceSummary = minPrice === maxPrice ? `ETB ${minPrice}` : `ETB ${minPrice} to ${maxPrice}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 md:grid-cols-3">
        <VariantMatrixMetric label="Variants" value={String(rows.length)} />
        <VariantMatrixMetric label="Total stocked" value={String(totalStock)} />
        <VariantMatrixMetric label="Price range" value={priceSummary} />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-background">
        <div className="flex flex-col gap-1 border-b bg-muted/30 px-4 py-3">
          <h3 className="text-sm font-medium">Generated variant matrix</h3>
          <p className="text-sm text-muted-foreground">
            Review every sellable row. Change SKU, price, or stock only where needed.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Variant</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Price</th>
                <th className="px-4 py-3 text-left font-medium">Initial stock</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const override = values[row.key] ?? {};

                return (
                  <tr className="border-t align-top" key={row.key}>
                    <td className="px-4 py-3">
                      <div className="mb-2 font-medium">
                        {Object.values(row.optionValues).join(" / ") || "Default variant"}
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
                            No options
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        aria-label={`SKU for ${row.key}`}
                        className="h-9"
                        onChange={(event) => onOverrideChange(row.key, { sku: event.target.value })}
                        value={override.sku ?? row.sku}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <InputGroup className="h-9">
                        <InputGroupAddon>ETB</InputGroupAddon>
                        <InputGroupInput
                          aria-label={`Price for ${row.key}`}
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
                        aria-label={`Stock for ${row.key}`}
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
