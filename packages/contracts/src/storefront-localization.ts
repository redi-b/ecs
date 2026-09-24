import { z } from "zod";

/** Customer-facing storefront languages supported by this release. */
export const storefrontLocales = ["en", "am"] as const;
export const storefrontLocaleSchema = z.enum(storefrontLocales);
export type StorefrontLocale = z.infer<typeof storefrontLocaleSchema>;

export const storefrontCommerceLocales = ["en-ET", "am-ET"] as const;
export const storefrontCommerceLocaleSchema = z.enum(storefrontCommerceLocales);
export type StorefrontCommerceLocale = z.infer<typeof storefrontCommerceLocaleSchema>;

export const storefrontLocaleDetails = {
  en: {
    commerceLocale: "en-ET",
    direction: "ltr",
    englishName: "English",
    nativeName: "English",
  },
  am: {
    commerceLocale: "am-ET",
    direction: "ltr",
    englishName: "Amharic",
    nativeName: "አማርኛ",
  },
} as const satisfies Record<
  StorefrontLocale,
  {
    commerceLocale: StorefrontCommerceLocale;
    direction: "ltr" | "rtl";
    englishName: string;
    nativeName: string;
  }
>;

export const defaultStorefrontLanguageSettings = {
  sourceLocale: "en",
  defaultLocale: "en",
  enabledLocales: ["en"],
} as const satisfies StorefrontLanguageSettings;

export const storefrontLanguageSettingsSchema = z
  .object({
    sourceLocale: storefrontLocaleSchema,
    defaultLocale: storefrontLocaleSchema,
    enabledLocales: z.array(storefrontLocaleSchema).min(1).max(storefrontLocales.length),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.enabledLocales).size !== value.enabledLocales.length) {
      context.addIssue({
        code: "custom",
        message: "Enabled storefront languages must be unique.",
        path: ["enabledLocales"],
      });
    }
    if (!value.enabledLocales.includes(value.sourceLocale)) {
      context.addIssue({
        code: "custom",
        message: "The original storefront language must be enabled.",
        path: ["sourceLocale"],
      });
    }
    if (!value.enabledLocales.includes(value.defaultLocale)) {
      context.addIssue({
        code: "custom",
        message: "The default storefront language must be enabled.",
        path: ["defaultLocale"],
      });
    }
  });

export type StorefrontLanguageSettings = z.infer<typeof storefrontLanguageSettingsSchema>;

export const storefrontLocalizedFieldSchema = z
  .object({
    value: z.string(),
    /** SHA-256 of the source value when this translation was last reviewed. */
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const storefrontLocalizedContentSchema = z
  .object({
    version: z.literal(1),
    locales: z.partialRecord(
      storefrontLocaleSchema,
      z.record(z.string().trim().min(1).max(240), storefrontLocalizedFieldSchema),
    ),
  })
  .strict();

export type StorefrontLocalizedContent = z.infer<typeof storefrontLocalizedContentSchema>;

export const catalogTranslationResourceTypes = [
  "product",
  "product_variant",
  "product_option",
  "product_option_value",
  "product_category",
  "product_collection",
  "shipping_option",
] as const;

export const catalogTranslationResourceTypeSchema = z.enum(catalogTranslationResourceTypes);
export type CatalogTranslationResourceType = z.infer<typeof catalogTranslationResourceTypeSchema>;

export const catalogTranslationFields = {
  product: ["title", "subtitle", "description", "material"],
  product_variant: ["title", "material"],
  product_option: ["title"],
  product_option_value: ["value"],
  product_category: ["name", "description"],
  product_collection: ["title"],
  shipping_option: ["name"],
} as const satisfies Record<CatalogTranslationResourceType, readonly string[]>;

export const catalogTranslationStatusSchema = z.enum(["using_english", "needs_review", "ready"]);
export type CatalogTranslationStatus = z.infer<typeof catalogTranslationStatusSchema>;

/** Compact Amharic name carried on catalog list/detail payloads for dashboard labels. */
export const catalogNameTranslationSchema = z.object({
  locale: z.literal("am"),
  status: catalogTranslationStatusSchema,
  title: z.string().min(1).nullable(),
});
export type CatalogNameTranslation = z.infer<typeof catalogNameTranslationSchema>;

export const catalogTranslationResourceQuerySchema = z
  .object({
    resourceType: catalogTranslationResourceTypeSchema,
    resourceId: z.string().trim().min(1).max(160),
    /** Required for product children so ownership can be checked without trusting the child id. */
    productId: z.string().trim().min(1).max(160).optional(),
    locale: storefrontLocaleSchema.exclude(["en"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      ["product_variant", "product_option", "product_option_value"].includes(value.resourceType) &&
      !value.productId
    ) {
      context.addIssue({
        code: "custom",
        message: "A product is required for this translation.",
        path: ["productId"],
      });
    }
  });

export const catalogTranslationUpdateSchema = catalogTranslationResourceQuerySchema.extend({
  translations: z.record(z.string().trim().min(1).max(80), z.string().trim().max(20_000)),
});

export const catalogTranslationBatchReadSchema = z
  .object({
    items: z.array(catalogTranslationResourceQuerySchema).min(1).max(100),
  })
  .strict();

export const catalogTranslationBatchUpdateSchema = z
  .object({
    items: z.array(catalogTranslationUpdateSchema).min(1).max(100),
  })
  .strict();

export const catalogTranslationResourceSchema = z
  .object({
    resourceType: catalogTranslationResourceTypeSchema,
    resourceId: z.string(),
    productId: z.string().nullable(),
    locale: storefrontLocaleSchema.exclude(["en"]),
    title: z.string(),
    source: z.record(z.string(), z.string()),
    translations: z.record(z.string(), z.string()),
    status: catalogTranslationStatusSchema,
    translatedFields: z.number().int().nonnegative(),
    totalFields: z.number().int().nonnegative(),
  })
  .strict();

export type CatalogTranslationResource = z.infer<typeof catalogTranslationResourceSchema>;

export const catalogTranslationQueueQuerySchema = z.object({
  locale: storefrontLocaleSchema.exclude(["en"]),
  resourceType: z
    .enum(["product", "product_category", "product_collection", "shipping_option"])
    .default("product"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  status: catalogTranslationStatusSchema.optional(),
  q: z.string().trim().max(120).optional(),
});

export const catalogTranslationQueueItemSchema = z.object({
  resourceId: z.string(),
  title: z.string(),
  status: catalogTranslationStatusSchema,
  translatedFields: z.number().int().nonnegative(),
  totalFields: z.number().int().nonnegative(),
});

export const catalogTranslationQueueSchema = z.object({
  items: z.array(catalogTranslationQueueItemSchema),
  count: z.number().int().nonnegative(),
  ready: z.number().int().nonnegative(),
  needsReview: z.number().int().nonnegative(),
  usingEnglish: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type CatalogTranslationQueue = z.infer<typeof catalogTranslationQueueSchema>;
export type CatalogTranslationQueueItem = z.infer<typeof catalogTranslationQueueItemSchema>;

export const emptyStorefrontLocalizedContent = {
  version: 1,
  locales: {},
} as const satisfies StorefrontLocalizedContent;

export function storefrontCommerceLocale(locale: StorefrontLocale): StorefrontCommerceLocale {
  return storefrontLocaleDetails[locale].commerceLocale;
}

export function storefrontRouteLocale(locale: StorefrontCommerceLocale): StorefrontLocale {
  return locale === "am-ET" ? "am" : "en";
}
