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

export const platformTenantMutationSchema = z.object({
  tenant: platformTenantSchema,
  redirectTo: z.string().min(1).nullable().optional(),
});

export const platformOnboardingProvisioningAttemptSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  name: z.string().min(1).nullable(),
  status: z.string().min(1),
  step: z.string().min(1),
  error: z.string().min(1).nullable(),
});

export const platformOnboardingStateSchema = z.object({
  user: z.object({
    id: z.string().min(1),
    email: z.string().min(1),
    name: z.string().min(1).nullable(),
  }),
  tenants: z.array(platformTenantSchema),
  primaryTenant: z
    .object({
      id: z.string().min(1),
      handle: z.string().min(1),
      primaryDomain: z.string().min(1),
      dashboardUrl: z.string().min(1),
    })
    .nullable(),
  latestProvisioningAttempt: platformOnboardingProvisioningAttemptSchema.nullable(),
});

export const platformHandleAvailabilitySchema = z.object({
  handle: z.string().min(1),
  available: z.boolean(),
  reason: z.enum(["invalid", "reserved", "taken"]).optional(),
  hostname: z.string().min(1).optional(),
});

export const platformTenantCreateRequestSchema = z.object({
  name: z.string().trim().min(2).max(80),
  handle: z.string().trim().min(1),
  templateId: z.string().min(1).optional(),
  templateKey: z.string().min(1).optional(),
  businessCategory: z.string().trim().min(1).max(80).optional(),
  contactPhone: z.string().trim().min(1).max(40).optional(),
});

export type PlatformTenant = z.infer<typeof platformTenantSchema>;

export type PlatformTenants = z.infer<typeof platformTenantsSchema>;

export type PlatformTenantDetail = z.infer<typeof platformTenantDetailSchema>;

export type PlatformTenantMutation = z.infer<typeof platformTenantMutationSchema>;

export type PlatformOnboardingState = z.infer<typeof platformOnboardingStateSchema>;

export type PlatformHandleAvailability = z.infer<typeof platformHandleAvailabilitySchema>;

export type PlatformTenantCreateRequest = z.infer<typeof platformTenantCreateRequestSchema>;

export const deliverySettingsSchema = z.object({
  delivery: z.object({
    tenantId: z.string().min(1),
    deliveryEnabled: z.boolean(),
    pickupEnabled: z.boolean(),
    phoneConfirmationRequired: z.boolean(),
    notesEnabled: z.boolean(),
    landmarkRequired: z.boolean(),
    defaultDeliveryFee: z.string().min(1),
    currency: z.string().min(1),
    zones: z.unknown(),
    updatedAt: z.string().min(1),
  }),
});

export type DeliverySettings = z.infer<typeof deliverySettingsSchema>;

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

export const merchantProductVariantWriteSchema = z.object({
  optionValues: z.record(z.string().min(1), z.string().min(1)),
  sku: z.string().min(1).nullable().optional(),
  priceAmount: z.number().nonnegative(),
  currencyCode: z.string().min(1),
  stockedQuantity: z.number().int().nonnegative().optional(),
});

export const merchantProductWriteSchema = z.object({
  categoryIds: z.array(z.string().min(1)).optional(),
  collectionId: z.string().min(1).nullable().optional(),
  currencyCode: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  handle: z.string().min(1).nullable().optional(),
  imageUrls: z.array(z.string().min(1)).optional(),
  options: z
    .array(
      z.object({
        title: z.string().min(1),
        values: z.array(z.string().min(1)).min(1),
      }),
    )
    .optional(),
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

export const merchantOrderPaymentMethodSchema = z.enum(["cod", "chapa", "unknown"]);

export type MerchantOrderPaymentMethod = z.infer<typeof merchantOrderPaymentMethodSchema>;

/** How money was received (mark-paid / Chapa auto). Distinct from checkout rail. */
export const merchantOrderSettlementMethodSchema = z.enum([
  "cash",
  "telebirr",
  "cbe_birr",
  "bank_transfer",
  "chapa",
  "other",
]);

export type MerchantOrderSettlementMethod = z.infer<typeof merchantOrderSettlementMethodSchema>;

export const merchantOrderSettlementSchema = z.object({
  method: merchantOrderSettlementMethodSchema,
  bankCode: z.string().min(1).nullable().optional(),
  bankName: z.string().min(1).nullable().optional(),
  accountLast4: z.string().min(1).nullable().optional(),
  accountLabel: z.string().min(1).nullable().optional(),
  receivingAccountId: z.string().min(1).nullable().optional(),
  reference: z.string().min(1).nullable().optional(),
  note: z.string().min(1).nullable().optional(),
  recordedAt: z.string().min(1).nullable().optional(),
});

export type MerchantOrderSettlement = z.infer<typeof merchantOrderSettlementSchema>;

export const merchantReceivingAccountSchema = z.object({
  id: z.string().min(1),
  bankCode: z.string().min(1).nullable(),
  bankName: z.string().min(1),
  accountName: z.string().min(1).nullable(),
  accountLast4: z.string().min(1).nullable(),
  label: z.string().min(1),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type MerchantReceivingAccount = z.infer<typeof merchantReceivingAccountSchema>;

export const merchantOrderSchema = z.object({
  id: z.string().min(1),
  displayId: z.number().int().nullable(),
  email: z.string().min(1).nullable(),
  customerId: z.string().min(1).nullable().optional(),
  status: z.string().min(1).nullable(),
  paymentStatus: z.string().min(1).nullable(),
  fulfillmentStatus: z.string().min(1).nullable(),
  paymentMethod: merchantOrderPaymentMethodSchema.nullable().optional(),
  paymentReference: z.string().min(1).nullable().optional(),
  settlement: merchantOrderSettlementSchema.nullable().optional(),
  note: z.string().min(1).nullable().optional(),
  currencyCode: z.string().min(1).nullable(),
  total: z.number().nullable(),
  subtotal: z.number().nullable().optional(),
  shippingTotal: z.number().nullable().optional(),
  discountTotal: z.number().nullable().optional(),
  itemCount: z.number().int().nonnegative().nullable().optional(),
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
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        productId: z.string().min(1).nullable().optional(),
        variantId: z.string().min(1).nullable().optional(),
        title: z.string().min(1).nullable(),
        /** Product name when Medusa separates product vs variant line title. */
        productTitle: z.string().min(1).nullable().optional(),
        /** Variant label / options summary (e.g. "Large / Red"). */
        variantTitle: z.string().min(1).nullable().optional(),
        quantity: z.number().nullable(),
        fulfilledQuantity: z.number().nullable().optional(),
        unitPrice: z.number().nullable(),
        total: z.number().nullable(),
        thumbnail: z.string().min(1).nullable(),
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

/**
 * Dedicated billing status (GET /platform/tenants/:tenantId/billing).
 * Same plan/sub/invoice shape as dashboard.billing, without the unavailable flag
 * (dedicated route returns 4xx instead).
 */
export const merchantBillingStatusSchema = z.object({
  subscription: z
    .object({
      id: z.string().min(1),
      status: z.string().min(1),
      billingCycle: z.string().min(1),
      manualPaymentState: z.string().min(1),
      currentPeriodStart: z.string().min(1).nullable(),
      currentPeriodEnd: z.string().min(1).nullable(),
      /** Free plan scheduled to start at period end (no refund of remaining paid days). */
      scheduledPlanId: z.string().min(1).nullable().optional(),
      scheduledPlanName: z.string().min(1).nullable().optional(),
      scheduledEffectiveAt: z.string().min(1).nullable().optional(),
    })
    .nullable(),
  plan: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      price: z.string().min(1),
      limits: z.unknown(),
      features: z.unknown(),
      isFree: z.boolean().optional(),
    })
    .nullable(),
  invoices: z.array(
    z.object({
      id: z.string().min(1),
      amount: z.string().min(1),
      currency: z.string().min(1),
      status: z.string().min(1),
      dueAt: z.string().min(1).nullable(),
      paidAt: z.string().min(1).nullable(),
      // Empty string can appear from DB/drivers; treat as null for clients.
      provider: z.preprocess(
        (value) => (value === "" ? null : value),
        z.string().min(1).nullable(),
      ),
      providerReference: z.preprocess(
        (value) => (value === "" ? null : value),
        z.string().min(1).nullable(),
      ),
      createdAt: z.string().min(1),
    }),
  ),
  availablePaidPlans: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        price: z.string().min(1),
        limits: z.unknown(),
        features: z.unknown(),
      }),
    )
    .optional(),
  /** Full active plan catalog for selection UI (includes current plan). */
  catalog: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        price: z.string().min(1),
        isFree: z.boolean(),
        isCurrent: z.boolean(),
      }),
    )
    .optional(),
});

/** Dashboard embeds billing with an unavailable flag when status cannot load. */
export const merchantDashboardBillingSchema = merchantBillingStatusSchema.extend({
  unavailable: z.boolean(),
});

export const merchantBillingResponseSchema = z.object({
  billing: merchantBillingStatusSchema,
});

export type MerchantBillingStatus = z.infer<typeof merchantBillingStatusSchema>;
export type MerchantDashboardBilling = z.infer<typeof merchantDashboardBillingSchema>;
export type MerchantBillingResponse = z.infer<typeof merchantBillingResponseSchema>;

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
    templateKey: z.string().min(1).nullable(),
    templateVersion: z.number().int().positive().nullable(),
  }),
  operations: z
    .object({
      range: z.object({
        label: z.string().min(1),
        days: z.number().int().positive(),
        sampledOrderCount: z.number().int().nonnegative(),
      }),
      totals: z.object({
        revenue: z.number().nonnegative().nullable(),
        orders: z.number().int().nonnegative().nullable(),
        products: z.number().int().nonnegative().nullable(),
        customers: z.number().int().nonnegative().nullable(),
        currencyCode: z.string().min(1).nullable(),
      }),
      attention: z.object({
        unfulfilledOrders: z.number().int().nonnegative().nullable(),
        unpaidOrders: z.number().int().nonnegative().nullable(),
        draftProducts: z.number().int().nonnegative().nullable(),
      }),
      customers: z.object({
        unique: z.number().int().nonnegative().nullable(),
        repeat: z.number().int().nonnegative().nullable(),
      }),
      breakdowns: z.object({
        orderStatus: z.array(
          z.object({
            label: z.string().min(1),
            count: z.number().int().nonnegative(),
          }),
        ),
        paymentStatus: z.array(
          z.object({
            label: z.string().min(1),
            count: z.number().int().nonnegative(),
          }),
        ),
        fulfillmentStatus: z.array(
          z.object({
            label: z.string().min(1),
            count: z.number().int().nonnegative(),
          }),
        ),
      }),
      series: z.array(
        z.object({
          date: z.string().min(1),
          revenue: z.number().nonnegative(),
          orders: z.number().int().nonnegative(),
          customers: z.number().int().nonnegative(),
        }),
      ),
      recentOrders: z.array(
        z.object({
          id: z.string().min(1),
          displayId: z.number().int().nullable(),
          email: z.string().min(1).nullable(),
          total: z.number().nullable(),
          currencyCode: z.string().min(1).nullable(),
          paymentStatus: z.string().min(1).nullable(),
          fulfillmentStatus: z.string().min(1).nullable(),
          createdAt: z.string().min(1).nullable(),
        }),
      ),
      unavailable: z.array(z.string().min(1)),
    })
    .optional(),
  analytics: z
    .object({
      range: z.object({
        days: z.number().int().positive(),
        from: z.string().min(1),
        to: z.string().min(1),
      }),
      totals: z.object({
        events: z.number().int().nonnegative(),
        storefrontEvents: z.number().int().nonnegative(),
        platformEvents: z.number().int().nonnegative(),
        medusaEvents: z.number().int().nonnegative(),
      }),
      topEvents: z.array(
        z.object({
          eventType: z.string().min(1),
          count: z.number().int().nonnegative(),
        }),
      ),
      unavailable: z.boolean(),
    })
    .optional(),
  billing: merchantDashboardBillingSchema.optional(),
});

export type MerchantDashboardSummary = z.infer<typeof merchantDashboardSummarySchema>;

/** Shell/auth payload only — no operations, analytics, or billing. */
export const merchantDashboardAccessSchema = merchantDashboardSummarySchema.pick({
  actor: true,
  commerce: true,
  domain: true,
  storefront: true,
  tenant: true,
});

export type MerchantDashboardAccess = z.infer<typeof merchantDashboardAccessSchema>;

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

export const storefrontDraftSchema = z.object({
  draft: z.object({
    tenantId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
    data: z.unknown(),
    themeTokens: z.unknown(),
    updatedAt: z.string().min(1),
    published: z
      .object({
        revisionId: z.string().min(1),
        publishedAt: z.string().min(1),
        data: z.unknown(),
        themeTokens: z.unknown(),
      })
      .nullable()
      .optional(),
  }),
});

export type StorefrontDraft = z.infer<typeof storefrontDraftSchema>;

export const storefrontPublishSchema = z.object({
  storefront: z.object({
    tenantId: z.string().min(1),
    publishedRevisionId: z.string().min(1),
    templateId: z.string().min(1),
    templateVersion: z.number().int().positive(),
    templateKey: z.string().min(1),
    publishedAt: z.string().min(1),
  }),
});

export type StorefrontPublish = z.infer<typeof storefrontPublishSchema>;

/** Response after pausing/unpublishing a shop (live storefront goes offline). */
export const storefrontUnpublishSchema = z.object({
  storefront: z.object({
    tenantId: z.string().min(1),
    isPublished: z.literal(false),
  }),
});

export type StorefrontUnpublish = z.infer<typeof storefrontUnpublishSchema>;

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

export const merchantDeleteResultSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean(),
});
export type MerchantDeleteResult = z.infer<typeof merchantDeleteResultSchema>;

export const merchantBatchDeleteResultSchema = z.object({
  ids: z.array(z.string().min(1)),
  deleted: z.boolean(),
});
export type MerchantBatchDeleteResult = z.infer<typeof merchantBatchDeleteResultSchema>;
