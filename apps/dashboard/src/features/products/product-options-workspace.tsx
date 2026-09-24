"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ProductFormValues } from "@/features/products/product-form-types";
import { ProductOptionsBuilder } from "@/features/products/product-options-builder";
import type {
  ProductOptionDraft,
  VariantMatrixRow,
} from "@/features/products/product-variant-matrix";
import { VariantMatrixTable } from "@/features/products/product-variant-matrix-table";
import { useI18n } from "@/i18n/provider";

export function ProductOptionsWorkspace({
  stableHeight = false,
  galleryImages,
  bulkValues,
  onApplyDefaults,
  onOptionsChange,
  onBulkValuesChange,
  onGalleryImageAdd,
  onOverrideChange,
  options,
  rows,
  values,
}: {
  galleryImages?: string[] | undefined;
  stableHeight?: boolean | undefined;
  bulkValues?: { priceAmount: string; stockedQuantity: string } | undefined;
  onApplyDefaults: (fields?: { price: boolean; stock: boolean }) => void;
  onGalleryImageAdd?: ((url: string) => void) | undefined;
  onBulkValuesChange?:
    | ((values: { priceAmount: string; stockedQuantity: string }) => void)
    | undefined;
  onOptionsChange: (options: ProductOptionDraft[]) => void;
  onOverrideChange: (
    key: string,
    override: {
      enabled?: boolean | undefined;
      imageSource?: "option" | "manual" | undefined;
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
      <div
        className={
          stableHeight
            ? "h-[clamp(18rem,58dvh,38rem)] min-h-0 overflow-y-auto overscroll-contain pr-1"
            : undefined
        }
      >
        {view === "options" ? (
          <ProductOptionsBuilder
            galleryImages={galleryImages}
            onChange={onOptionsChange}
            options={options}
          />
        ) : (
          <VariantMatrixTable
            galleryImages={galleryImages}
            bulkValues={bulkValues}
            onApplyDefaults={onApplyDefaults}
            onGalleryImageAdd={onGalleryImageAdd}
            onBulkValuesChange={onBulkValuesChange}
            onOverrideChange={onOverrideChange}
            rows={rows}
            values={values}
          />
        )}
      </div>
    </div>
  );
}
