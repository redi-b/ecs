import { z } from "zod";

export const tenantStatusSchema = z.enum(["draft", "active", "suspended", "cancelled"]);

export type TenantStatus = z.infer<typeof tenantStatusSchema>;

export const tenantMemberRoleSchema = z.enum(["owner", "manager", "staff", "operator"]);

export type TenantMemberRole = z.infer<typeof tenantMemberRoleSchema>;

export const tenantReadinessMissingReasonSchema = z.enum([
  "tenant_inactive",
  "primary_domain_missing",
  "primary_domain_inactive",
  "primary_domain_unverified",
  "commerce_store_missing",
  "commerce_sales_channel_missing",
  "commerce_publishable_key_missing",
  "commerce_region_missing",
  "commerce_shipping_option_missing",
  "storefront_draft_missing",
  "storefront_unpublished",
  "provisioning_failed",
]);

export type TenantReadinessMissingReason = z.infer<typeof tenantReadinessMissingReasonSchema>;

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

export const platformTenantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  handle: z.string().min(1),
  status: tenantStatusSchema,
  role: tenantMemberRoleSchema,
  primaryDomain: z.object({
    hostname: z.string().min(1).nullable(),
  }),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const platformTenantsSchema = z.object({
  tenants: z.array(platformTenantSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export const platformTenantDetailSchema = z.object({
  tenant: platformTenantSchema,
});

export type PlatformTenant = z.infer<typeof platformTenantSchema>;

export type PlatformTenants = z.infer<typeof platformTenantsSchema>;

export type PlatformTenantDetail = z.infer<typeof platformTenantDetailSchema>;

export const tenantInsightsSummarySchema = z.object({
  summary: z.object({
    tenantId: z.string().min(1),
    range: z.object({
      days: z.number().int().positive(),
      from: z.string().min(1),
      to: z.string().min(1),
    }),
    totals: z.object({
      events: z.number().int().nonnegative(),
      medusaEvents: z.number().int().nonnegative(),
      platformEvents: z.number().int().nonnegative(),
      storefrontEvents: z.number().int().nonnegative(),
    }),
    topEvents: z.array(
      z.object({
        eventType: z.string().min(1),
        count: z.number().int().nonnegative(),
      }),
    ),
    recentEvents: z.array(
      z.object({
        id: z.string().min(1),
        eventType: z.string().min(1),
        occurredAt: z.string().min(1),
        source: z.enum(["medusa", "platform", "storefront"]),
        subjectId: z.string().min(1).nullable(),
        subjectType: z.string().min(1).nullable(),
      }),
    ),
  }),
});

export type TenantInsightsSummary = z.infer<typeof tenantInsightsSummarySchema>;

export const platformErrorSchema = z.object({
  error: z.string().min(1),
  requestId: z.string().min(1).optional(),
});

export type PlatformError = z.infer<typeof platformErrorSchema>;

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
  variants: z
    .array(
      z.object({
        id: z.string().min(1),
        inventoryItemId: z.string().min(1).nullable().optional(),
        title: z.string().min(1).nullable(),
        sku: z.string().min(1).nullable(),
        prices: z.array(
          z.object({
            amount: z.number().nullable(),
            currencyCode: z.string().min(1).nullable(),
          }),
        ),
      }),
    )
    .optional(),
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

export const merchantProductCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).nullable(),
  handle: z.string().min(1).nullable(),
  isActive: z.boolean().nullable(),
  isInternal: z.boolean().nullable(),
  parentCategoryId: z.string().min(1).nullable(),
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
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
  createdAt: z.string().min(1).nullable(),
  updatedAt: z.string().min(1).nullable(),
});

export const merchantProductCollectionsSchema = z.object({
  collections: z.array(merchantProductCollectionSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type MerchantProduct = z.infer<typeof merchantProductSchema>;

export type MerchantProductCategories = z.infer<typeof merchantProductCategoriesSchema>;

export type MerchantProductCategory = z.infer<typeof merchantProductCategorySchema>;

export type MerchantProductCollection = z.infer<typeof merchantProductCollectionSchema>;

export type MerchantProductCollections = z.infer<typeof merchantProductCollectionsSchema>;

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
  delivery: z
    .object({
      choice: z.string().min(1).nullable(),
      customerName: z.string().min(1).nullable(),
      customerPhone: z.string().min(1).nullable(),
      landmark: z.string().min(1).nullable(),
      notes: z.string().min(1).nullable(),
    })
    .optional(),
  fulfillments: z
    .array(
      z.object({
        id: z.string().min(1),
        deliveredAt: z.string().min(1).nullable(),
        shippedAt: z.string().min(1).nullable(),
        canceledAt: z.string().min(1).nullable(),
      }),
    )
    .optional(),
  shippingAddress: z
    .object({
      firstName: z.string().min(1).nullable(),
      lastName: z.string().min(1).nullable(),
      phone: z.string().min(1).nullable(),
      address1: z.string().min(1).nullable(),
      address2: z.string().min(1).nullable(),
      city: z.string().min(1).nullable(),
      province: z.string().min(1).nullable(),
      postalCode: z.string().min(1).nullable(),
      countryCode: z.string().min(1).nullable(),
    })
    .optional(),
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

export const notificationPreferenceSchema = z.object({
  id: z.string().min(1),
  channel: z.string().min(1),
  enabled: z.boolean(),
  events: z.array(z.string().min(1)),
  target: z.string().min(1),
  updatedAt: z.string().min(1),
});

export const notificationPreferencesSchema = z.object({
  preferences: z.array(notificationPreferenceSchema),
});

export const notificationPreferenceMutationSchema = z.object({
  preference: notificationPreferenceSchema,
});

export type NotificationPreference = z.infer<typeof notificationPreferenceSchema>;

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export type NotificationPreferenceMutation = z.infer<typeof notificationPreferenceMutationSchema>;

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

export const tenantReadinessSchema = z.object({
  readiness: z.object({
    ready: z.boolean(),
    missing: z.array(tenantReadinessMissingReasonSchema),
    tenant: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      handle: z.string().min(1),
      status: tenantStatusSchema,
    }),
    checks: z.object({
      tenant: z.object({
        ready: z.boolean(),
        missing: z.array(tenantReadinessMissingReasonSchema),
        isActive: z.boolean(),
      }),
      domain: z.object({
        ready: z.boolean(),
        missing: z.array(tenantReadinessMissingReasonSchema),
        hasPrimaryDomain: z.boolean(),
        isActive: z.boolean(),
        isVerified: z.boolean(),
      }),
      commerce: z.object({
        ready: z.boolean(),
        missing: z.array(tenantReadinessMissingReasonSchema),
        hasStore: z.boolean(),
        hasSalesChannel: z.boolean(),
        hasPublishableKey: z.boolean(),
        hasRegion: z.boolean(),
        hasShippingOption: z.boolean(),
      }),
      storefront: z.object({
        ready: z.boolean(),
        missing: z.array(tenantReadinessMissingReasonSchema),
        hasDraft: z.boolean(),
        isPublished: z.boolean(),
      }),
      provisioning: z.object({
        ready: z.boolean(),
        missing: z.array(tenantReadinessMissingReasonSchema),
        latestAttempt: z
          .object({
            id: z.string().min(1),
            completedAt: z.string().min(1).nullable(),
            error: z.string().min(1).nullable(),
            status: z.string().min(1),
            step: z.string().min(1),
          })
          .nullable(),
      }),
    }),
  }),
});

export type TenantReadiness = z.infer<typeof tenantReadinessSchema>;

export const tenantProvisioningAttemptSchema = z.object({
  id: z.string().min(1),
  completedAt: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  error: z.string().min(1).nullable(),
  handle: z.string().min(1),
  name: z.string().min(1),
  platformTenantId: z.string().min(1),
  status: z.string().min(1),
  step: z.string().min(1),
  tenantId: z.string().min(1).nullable(),
});

export const tenantProvisioningAttemptsSchema = z.object({
  attempts: z.array(tenantProvisioningAttemptSchema),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type TenantProvisioningAttempt = z.infer<typeof tenantProvisioningAttemptSchema>;

export type TenantProvisioningAttempts = z.infer<typeof tenantProvisioningAttemptsSchema>;

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
