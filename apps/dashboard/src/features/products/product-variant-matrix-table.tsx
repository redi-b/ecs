"use client";

import * as React from "react";
import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import type { ProductFormValues } from "@/features/products/product-form-types";
import { VariantImagePicker } from "@/features/products/product-variant-image-picker";
import type { VariantMatrixRow } from "@/features/products/product-variant-matrix";
import { useI18n } from "@/i18n/provider";

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
      imageSource?: "option" | "manual" | undefined;
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
            <p className="text-xs text-muted-foreground">
              {t("products.formReview.generatedCount", { count: rows.length })} • Photos follow
              Media tags by default. Select a row’s photo to give that variant its own image.
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
                      imageSource={override.imageSource}
                      onRemoveImage={() =>
                        onOverrideChange(row.key, { imageUrl: undefined, imageSource: undefined })
                      }
                      onSelectImage={(url) =>
                        onOverrideChange(row.key, { imageUrl: url, imageSource: "manual" })
                      }
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
                <th className="w-14 px-4 py-3 text-left font-medium">Photo</th>
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
                        imageSource={override.imageSource}
                        onRemoveImage={() =>
                          onOverrideChange(row.key, { imageUrl: undefined, imageSource: undefined })
                        }
                        onSelectImage={(url) =>
                          onOverrideChange(row.key, { imageUrl: url, imageSource: "manual" })
                        }
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
