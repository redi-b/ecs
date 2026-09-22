"use client";

import * as React from "react";
import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ProductFormValues } from "@/features/products/product-form-types";
import type {
  ProductOptionDraft,
  VariantMatrixRow,
} from "@/features/products/product-variant-matrix";
import { ProductOptionsBuilder } from "@/features/products/product-options-builder";
import { VariantMatrixTable } from "@/features/products/product-variant-matrix-table";
import { useI18n } from "@/i18n/provider";

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
