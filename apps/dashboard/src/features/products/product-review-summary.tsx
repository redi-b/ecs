"use client";

import * as React from "react";
import {
  getRemovedExistingVariants,
  getVariantRows,
  normalizeProductOptions,
} from "@/features/products/product-form-state";
import type { ProductFormValues } from "@/features/products/product-form-types";
import { useI18n } from "@/i18n/provider";

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
