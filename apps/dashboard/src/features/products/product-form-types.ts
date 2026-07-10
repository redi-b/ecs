"use client";

import type {
  MerchantProduct,
  MerchantProductCategory,
  MerchantProductCollection,
} from "@ecs/contracts";
import type { ReactNode } from "react";
import { z } from "zod";

import type { ProductOptionDraft } from "@/features/products/product-variant-matrix";

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
};

export const PRODUCT_STEPS: ComposerStep[] = [
  { id: "details", label: "Details" },
  { id: "organize", label: "Organize" },
  { id: "variants", label: "Pricing & stock" },
  { id: "review", label: "Review" },
];

export const productPayloadSchema = z.object({
  title: z.string().trim().min(1, "Enter a product title."),
  description: z.string().trim().nullable(),
  handle: z.string().trim().nullable(),
  thumbnail: z.string().trim().nullable(),
  imageUrls: z
    .array(z.string().trim().url("Use full image URLs that start with http:// or https://."))
    .optional(),
  status: z.enum(["draft", "published"]),
  priceAmount: z.number().int().nonnegative("Price cannot be negative."),
  currencyCode: z.literal("etb"),
  options: z
    .array(
      z.object({
        title: z.string().trim().min(1, "Enter an option name."),
        values: z.array(z.string().trim().min(1)).min(1, "Enter at least one option value."),
      }),
    )
    .optional(),
  variants: z
    .array(
      z.object({
        optionValues: z.record(z.string().min(1), z.string().min(1)),
        sku: z.string().trim().nullable(),
        priceAmount: z.number().int().nonnegative("Price cannot be negative."),
        currencyCode: z.literal("etb"),
        stockedQuantity: z.number().int().nonnegative("Stock cannot be negative."),
      }),
    )
    .optional(),
  collectionId: z.string().trim().nullable(),
  categoryIds: z.array(z.string().min(1)),
});
