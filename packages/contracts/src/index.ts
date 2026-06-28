import { z } from "zod";

export const tenantStatusSchema = z.enum(["draft", "active", "suspended", "cancelled"]);

export type TenantStatus = z.infer<typeof tenantStatusSchema>;

export const tenantContextSchema = z.object({
  tenantId: z.string().min(1),
  hostname: z.string().min(1),
  domainId: z.string().min(1).optional(),
  status: tenantStatusSchema,
  medusaStoreId: z.string().min(1),
  medusaSalesChannelId: z.string().min(1),
  medusaPublishableKey: z.string().min(1),
  medusaRegionId: z.string().min(1),
  publishedRevisionId: z.string().min(1).optional(),
  templateKey: z.string().min(1).optional(),
});

export type TenantContext = z.infer<typeof tenantContextSchema>;

export const platformErrorSchema = z.object({
  error: z.string().min(1),
  requestId: z.string().min(1).optional(),
});

export type PlatformError = z.infer<typeof platformErrorSchema>;

export const merchantProductSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).nullable(),
  handle: z.string().min(1).nullable(),
  status: z.string().min(1).nullable(),
  thumbnail: z.string().min(1).nullable(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
});

export const merchantProductsSchema = z.object({
  products: z.array(merchantProductSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const merchantProductMutationSchema = z.object({
  product: merchantProductSchema,
});

export type MerchantProduct = z.infer<typeof merchantProductSchema>;

export type MerchantProductMutation = z.infer<typeof merchantProductMutationSchema>;

export type MerchantProducts = z.infer<typeof merchantProductsSchema>;

export const merchantOrderSchema = z.object({
  id: z.string().min(1),
  displayId: z.number().int().nullable(),
  email: z.string().min(1).nullable(),
  status: z.string().min(1).nullable(),
  paymentStatus: z.string().min(1).nullable(),
  fulfillmentStatus: z.string().min(1).nullable(),
  currencyCode: z.string().min(1).nullable(),
  total: z.number().nullable(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
});

export const merchantOrdersSchema = z.object({
  orders: z.array(merchantOrderSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type MerchantOrder = z.infer<typeof merchantOrderSchema>;

export type MerchantOrders = z.infer<typeof merchantOrdersSchema>;

export const merchantDashboardSummarySchema = z.object({
  tenant: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    handle: z.string().min(1),
    status: tenantStatusSchema,
  }),
  domain: z.object({
    id: z.string().min(1),
    hostname: z.string().min(1),
  }),
  actor: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1).nullable(),
    role: z.enum(["owner", "manager", "staff", "operator"]),
  }),
  commerce: z.object({
    hasPublishableKey: z.boolean(),
    hasSalesChannel: z.boolean(),
    hasStore: z.boolean(),
  }),
  storefront: z.object({
    isPublished: z.boolean(),
    publishedRevisionId: z.string().min(1).nullable(),
    templateId: z.string().min(1).nullable(),
    templateVersion: z.number().int().positive().nullable(),
  }),
});

export type MerchantDashboardSummary = z.infer<typeof merchantDashboardSummarySchema>;

export const storefrontTemplateCatalogItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  previewAssetId: z.string().min(1).nullable(),
  tags: z.unknown(),
  minimumPlanId: z.string().min(1).nullable(),
  version: z.object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    templateKey: z.string().min(1),
    previewData: z.unknown(),
  }),
});

export const storefrontTemplateCatalogSchema = z.object({
  templates: z.array(storefrontTemplateCatalogItemSchema),
});

export type StorefrontTemplateCatalogItem = z.infer<typeof storefrontTemplateCatalogItemSchema>;

export const storefrontTemplateSelectionSchema = z.object({
  draft: z.object({
    tenantId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
  }),
});

export type StorefrontTemplateSelection = z.infer<typeof storefrontTemplateSelectionSchema>;

export const publishedStorefrontConfigSchema = z.object({
  tenant: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    handle: z.string().min(1),
    status: tenantStatusSchema,
    domain: z.object({
      id: z.string().min(1),
      hostname: z.string().min(1),
    }),
  }),
  commerce: z.object({
    regionId: z.string().min(1),
  }),
  storefront: z.object({
    publishedRevisionId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
    data: z.unknown(),
    themeTokens: z.unknown(),
    publishedAt: z.string().min(1).nullable(),
  }),
});

export type PublishedStorefrontConfig = z.infer<typeof publishedStorefrontConfigSchema>;
