"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import type { ReactNode } from "react";
import { z } from "zod";

import type { ProductOptionDraft } from "@/features/products/product-variant-matrix";
import type { MessageKey } from "@/i18n/messages";

type Translate = (key: MessageKey, values?: Record<string, string | number | Date>) => string;

export type ProductFormProps = {
  action: string;
  categories: MerchantProductCategory[];
  collections: MerchantProductCollection[];
  notice?: ReactNode;
  onClose?: (() => void) | undefined;
  open?: boolean | undefined;
  product?: MerchantProduct | undefined;
  returnHref?: string | undefined;
  submitLabel: string;
};

export type ProductFormValues = {
  title: string;
  description: string;
  handle: string;
  thumbnail: string;
  imageUrls: string;
  status: "draft" | "published";
  priceAmount: string;
  currencyCode: "etb";
  hasVariants: boolean;
  initialStock: string;
  options: ProductOptionDraft[];
  skuPrefix: string;
  variantOverrides: Record<
    string,
    {
      priceAmount?: string | undefined;
      sku?: string | undefined;
      stockedQuantity?: string | undefined;
    }
  >;
  collectionId: string;
  categoryIds: string[];
};

export type ComposerStep = {
  id: "details" | "organize" | "variants" | "review";
  label: string;
  /** Shorter label for narrow step rails (mobile). */
  shortLabel: string;
};

export const PRODUCT_STEPS: ComposerStep[] = [
  { id: "details", label: "Details", shortLabel: "Details" },
  { id: "organize", label: "Organize", shortLabel: "Organize" },
  { id: "variants", label: "Pricing & stock", shortLabel: "Pricing" },
  { id: "review", label: "Review", shortLabel: "Review" },
];

/** English-default schema for type inference and non-UI parse paths. */
export const productPayloadSchema = createProductPayloadSchema((key) => {
  const fallback: Record<string, string> = {
    "products.validation.titleRequired": "Enter a product title.",
    "products.validation.imageUrlFull":
      "Use full image URLs that start with http:// or https://.",
    "products.validation.priceNonNegative": "Price cannot be negative.",
    "products.validation.optionNameRequired": "Enter an option name.",
    "products.validation.optionValueRequired": "Enter at least one option value.",
    "products.validation.stockNonNegative": "Stock cannot be negative.",
  };
  return fallback[key] ?? key;
});

export function createProductPayloadSchema(t: Translate) {
  return z.object({
    title: z.string().trim().min(1, t("products.validation.titleRequired")),
    description: z.string().trim().nullable(),
    handle: z.string().trim().nullable(),
    thumbnail: z.string().trim().nullable(),
    imageUrls: z
      .array(z.string().trim().url(t("products.validation.imageUrlFull")))
      .optional(),
    status: z.enum(["draft", "published"]),
    priceAmount: z.number().int().nonnegative(t("products.validation.priceNonNegative")),
    currencyCode: z.literal("etb"),
    options: z
      .array(
        z.object({
          title: z.string().trim().min(1, t("products.validation.optionNameRequired")),
          values: z
            .array(z.string().trim().min(1))
            .min(1, t("products.validation.optionValueRequired")),
        }),
      )
      .optional(),
    variants: z
      .array(
        z.object({
          optionValues: z.record(z.string().min(1), z.string().min(1)),
          sku: z.string().trim().nullable(),
          priceAmount: z.number().int().nonnegative(t("products.validation.priceNonNegative")),
          currencyCode: z.literal("etb"),
          stockedQuantity: z
            .number()
            .int()
            .nonnegative(t("products.validation.stockNonNegative")),
        }),
      )
      .optional(),
    collectionId: z.string().trim().nullable(),
    categoryIds: z.array(z.string().min(1)),
  });
}
