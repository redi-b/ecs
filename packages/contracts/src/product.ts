import { z } from "zod";

import { catalogNameTranslationSchema } from "./storefront-localization";

export const merchantProductVariantWriteSchema = z.object({
  id: z.string().min(1).optional(),
  optionValues: z.record(z.string().min(1), z.string().min(1)),
  sku: z.string().min(1).nullable().optional(),
  priceAmount: z.number().nonnegative(),
  currencyCode: z.string().min(1),
  stockedQuantity: z.number().int().nonnegative().optional(),
  imageUrl: z.string().url().nullable().optional(),
  imageSource: z.enum(["option", "manual"]).nullable().optional(),
});

export const PRODUCT_OPTION_VALUE_PRESENTATION_METADATA_KEY =
  "ecs_option_value_presentation" as const;

export const PRODUCT_OPTION_VALUE_PRESENTATIONS_ADDITIONAL_DATA_KEY =
  "ecs_product_option_value_presentations" as const;

export const productColorSwatchSchema = z.object({
  kind: z.literal("color"),
  value: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const productImageSwatchSchema = z.object({
  kind: z.literal("image"),
  url: z.string().url(),
});

export const productOptionSwatchSchema = z.discriminatedUnion("kind", [
  productColorSwatchSchema,
  productImageSwatchSchema,
]);

export const productOptionValueWriteSchema = z.union([
  z.string().trim().min(1),
  z.object({
    id: z.string().trim().min(1).optional(),
    label: z.string().trim().min(1),
    swatch: productOptionSwatchSchema.nullable().optional(),
  }),
]);

export const merchantProductOptionWriteSchema = z.object({
  displayMode: z.enum(["text", "swatch"]).optional(),
  id: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1),
  values: z.array(productOptionValueWriteSchema).min(1),
});

export const productOptionValuePresentationWriteSchema = z.object({
  displayMode: z.enum(["text", "swatch"]).optional(),
  optionId: z.string().trim().min(1).optional(),
  optionTitle: z.string().trim().min(1),
  valueId: z.string().trim().min(1).optional(),
  valueLabel: z.string().trim().min(1),
  swatch: productOptionSwatchSchema.nullable(),
});

export const productOptionValuePresentationsAdditionalDataSchema = z.object({
  version: z.literal(1),
  values: z.array(productOptionValuePresentationWriteSchema),
});

export const productOptionMediaBindingsSchema = z.object({
  optionTitle: z.string().min(1),
  mappings: z.record(z.string().min(1), z.array(z.string().min(1))),
});

export type ProductOptionMediaBindings = z.infer<typeof productOptionMediaBindingsSchema>;

export const merchantProductWriteSchema = z.object({
  categoryIds: z.array(z.string().min(1)).optional(),
  collectionId: z.string().min(1).nullable().optional(),
  currencyCode: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  handle: z.string().min(1).nullable().optional(),
  imageUrls: z.array(z.string().min(1)).optional(),
  optionMediaBindings: productOptionMediaBindingsSchema.nullable().optional(),
  options: z.array(merchantProductOptionWriteSchema).optional(),
  priceAmount: z.number().nonnegative().optional(),
  status: z.string().min(1).nullable().optional(),
  thumbnail: z.string().min(1).nullable().optional(),
  title: z.string().min(1).nullable().optional(),
  variants: z.array(merchantProductVariantWriteSchema).optional(),
});

export type MerchantProductVariantWrite = z.infer<typeof merchantProductVariantWriteSchema>;
export type MerchantProductWrite = z.infer<typeof merchantProductWriteSchema>;

export const merchantProductStockSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  inventoryItemId: z.string().min(1),
  locationId: z.string().min(1),
  stockedQuantity: z.number().nullable(),
  reservedQuantity: z.number().nullable(),
  incomingQuantity: z.number().nullable(),
  availableQuantity: z.number().nullable(),
});

export const productColorSwatchWithSourceSchema = productColorSwatchSchema.extend({
  source: z.enum(["explicit", "inferred"]),
});

export const productImageSwatchWithSourceSchema = productImageSwatchSchema.extend({
  source: z.enum(["explicit", "inferred"]),
});

export const productOptionSwatchWithSourceSchema = z.discriminatedUnion("kind", [
  productColorSwatchWithSourceSchema,
  productImageSwatchWithSourceSchema,
]);

export const productOptionValuePresentationSchema = z.object({
  label: z.string().min(1),
  swatch: productOptionSwatchWithSourceSchema.optional(),
});

export const merchantProductOptionValueSchema = productOptionValuePresentationSchema.extend({
  id: z.string().min(1).nullable(),
});

export const merchantProductOptionSchema = z.object({
  displayMode: z.enum(["text", "swatch"]).optional(),
  id: z.string().min(1).nullable(),
  title: z.string().min(1),
  values: z.array(merchantProductOptionValueSchema),
});

export const merchantProductSchema = z.object({
  id: z.string().min(1),
  categoryIds: z.array(z.string().min(1)).optional(),
  collectionId: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  title: z.string().min(1).nullable(),
  handle: z.string().min(1).nullable(),
  status: z.string().min(1).nullable(),
  thumbnail: z.string().min(1).nullable(),
  images: z
    .array(
      z.object({
        id: z.string().min(1),
        url: z.string().min(1).nullable(),
        rank: z.number().int().nullable(),
        createdAt: z.string().min(1).nullable(),
        updatedAt: z.string().min(1).nullable(),
      }),
    )
    .optional(),
  options: z.array(merchantProductOptionSchema).optional(),
  optionMediaBindings: productOptionMediaBindingsSchema.nullable().optional(),
  variants: z
    .array(
      z.object({
        id: z.string().min(1),
        inventoryItemId: z.string().min(1).nullable().optional(),
        title: z.string().min(1).nullable(),
        sku: z.string().min(1).nullable(),
        imageUrl: z.string().url().nullable().optional(),
        imageSource: z.enum(["option", "manual"]).nullable().optional(),
        optionValues: z
          .array(
            z.object({
              optionTitle: z.string().min(1).nullable(),
              value: z.string().min(1).nullable(),
            }),
          )
          .optional(),
        prices: z.array(
          z.object({
            amount: z.number().nullable(),
            currencyCode: z.string().min(1).nullable(),
          }),
        ),
        stock: merchantProductStockSchema
          .omit({
            productId: true,
            variantId: true,
            inventoryItemId: true,
          })
          .nullable()
          .optional(),
      }),
    )
    .optional(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
  translation: catalogNameTranslationSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const merchantProductsSchema = z.object({
  products: z.array(merchantProductSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const merchantProductMutationSchema = z.object({
  product: merchantProductSchema,
  mediaSyncWarning: z.boolean().optional(),
});

export const merchantProductStockResponseSchema = z.object({
  stock: merchantProductStockSchema,
});

export const merchantProductCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).nullable(),
  handle: z.string().min(1).nullable(),
  isActive: z.boolean().nullable(),
  isInternal: z.boolean().nullable(),
  parentCategoryId: z.string().min(1).nullable(),
  /** Sibling order from Medusa `rank` (lower first). */
  rank: z.number().int().nullable().optional(),
  visibility: z.enum(["public", "hidden"]).optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  mediaUrl: z.string().nullable().optional(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
  translation: catalogNameTranslationSchema.optional(),
});

export const merchantProductCategoriesSchema = z.object({
  categories: z.array(merchantProductCategorySchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const merchantProductCollectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).nullable(),
  handle: z.string().min(1).nullable(),
  visibility: z.enum(["public", "hidden"]).optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  mediaUrl: z.string().nullable().optional(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
  translation: catalogNameTranslationSchema.optional(),
});

export const merchantProductCollectionsSchema = z.object({
  collections: z.array(merchantProductCollectionSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type MerchantProduct = z.infer<typeof merchantProductSchema>;

export type MerchantProductOption = z.infer<typeof merchantProductOptionSchema>;

export type MerchantProductOptionValue = z.infer<typeof merchantProductOptionValueSchema>;

export type ProductColorSwatch = z.infer<typeof productColorSwatchSchema>;

export type ProductImageSwatch = z.infer<typeof productImageSwatchSchema>;

export type ProductOptionSwatch = z.infer<typeof productOptionSwatchSchema>;

export type ProductOptionSwatchWithSource = z.infer<typeof productOptionSwatchWithSourceSchema>;

export type ProductOptionValuePresentation = z.infer<typeof productOptionValuePresentationSchema>;

export type ProductOptionValuePresentationWrite = z.infer<
  typeof productOptionValuePresentationWriteSchema
>;

export type ProductOptionValuePresentationsAdditionalData = z.infer<
  typeof productOptionValuePresentationsAdditionalDataSchema
>;

export type ProductOptionValueWrite = z.infer<typeof productOptionValueWriteSchema>;

export type MerchantProductCategories = z.infer<typeof merchantProductCategoriesSchema>;

export type MerchantProductCategory = z.infer<typeof merchantProductCategorySchema>;

export type MerchantProductCollection = z.infer<typeof merchantProductCollectionSchema>;

export type MerchantProductCollections = z.infer<typeof merchantProductCollectionsSchema>;

export type MerchantProductMutation = z.infer<typeof merchantProductMutationSchema>;

export type MerchantProducts = z.infer<typeof merchantProductsSchema>;

/** Aggregated merchant command-center / global search. */
export const merchantSearchHitTypeSchema = z.enum([
  "product",
  "order",
  "customer",
  "media",
  "category",
  "collection",
  "promotion",
]);

export const merchantSearchHitSchema = z.object({
  id: z.string().min(1),
  type: merchantSearchHitTypeSchema,
  label: z.string().min(1),
  description: z.string().min(1).nullable(),
  status: z.string().min(1).nullable(),
});

export const merchantSearchResponseSchema = z.object({
  results: z.array(merchantSearchHitSchema),
  query: z.string(),
});

export type MerchantSearchHitType = z.infer<typeof merchantSearchHitTypeSchema>;
export type MerchantSearchHit = z.infer<typeof merchantSearchHitSchema>;
export type MerchantSearchResponse = z.infer<typeof merchantSearchResponseSchema>;

export type MerchantProductStock = z.infer<typeof merchantProductStockSchema>;

export type MerchantProductStockResponse = z.infer<typeof merchantProductStockResponseSchema>;
