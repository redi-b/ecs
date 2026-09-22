import type { ProductOptionMediaBindings, ProductOptionSwatch } from "@ecs/contracts";
import type { MerchantProduct, MerchantProductVariant } from "../../../types/index.js";

export type { MerchantProduct, MerchantProductVariant };

export type ProductWriteInput = {
  categoryIds?: string[] | undefined;
  collectionId?: string | null | undefined;
  currencyCode?: string | null | undefined;
  description?: string | null | undefined;
  handle?: string | null | undefined;
  imageUrls?: string[] | undefined;
  metadata?: Record<string, unknown> | undefined;
  optionMediaBindings?: ProductOptionMediaBindings | null | undefined;
  options?: ProductOptionInput[] | undefined;
  priceAmount?: number | undefined;
  regionId?: string | null | undefined;
  salesChannelId: string;
  shippingProfileId?: string | null | undefined;
  status?: string | null | undefined;
  stockLocationId?: string | null | undefined;
  tenantId?: string | undefined;
  thumbnail?: string | null | undefined;
  title?: string | null | undefined;
  variants?: ProductVariantWriteInput[] | undefined;
};

export type ProductOptionInput = {
  id?: string | undefined;
  title: string;
  values: ProductOptionValueInput[];
};

export type ProductOptionValueInput = {
  id?: string | undefined;
  label: string;
  swatch?: ProductOptionSwatch | null | undefined;
} | string;

export type ProductVariantWriteInput = {
  currencyCode: string;
  /** Existing Medusa variant identity. Required when an import updates a variant in place. */
  id?: string | null | undefined;
  imageUrl?: string | null | undefined;
  metadata?: Record<string, unknown> | undefined;
  optionValues: Record<string, string>;
  priceAmount?: number | undefined;
  prices?: Array<{ amount: number; currencyCode: string }> | undefined;
  sku?: string | null | undefined;
  stockedQuantity?: number | undefined;
};

export type ProductUpdateInput = ProductWriteInput & {
  productId: string;
};

export type ProductCategoryWriteInput = {
  handle?: string | null | undefined;
  name: string;
  tenantId: string;
  parentCategoryId?: string | null | undefined;
  /** Medusa sibling order among categories with the same parent. */
  rank?: number | null | undefined;
  visibility?: "public" | "hidden" | undefined;
  seoTitle?: string | null | undefined;
  seoDescription?: string | null | undefined;
  mediaUrl?: string | null | undefined;
};

export type ProductCollectionWriteInput = {
  handle?: string | null | undefined;
  tenantId: string;
  title: string;
  visibility?: "public" | "hidden" | undefined;
  seoTitle?: string | null | undefined;
  seoDescription?: string | null | undefined;
  mediaUrl?: string | null | undefined;
};

export type ProductStockInput = {
  productId: string;
  salesChannelId: string;
  stockLocationId: string;
};

export type ProductStockUpdateInput = ProductStockInput & {
  stockedQuantity: number;
};

export type ProductVariantStockInput = ProductStockInput & {
  variantId: string;
};

export type ProductVariantStockUpdateInput = ProductVariantStockInput & {
  stockedQuantity: number;
};
