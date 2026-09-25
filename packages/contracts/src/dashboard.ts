import { z } from "zod";

import { profileAvatarSchema, shopDetailsSchema, userCalendarPreferenceSchema } from "./account";
import { merchantDashboardBillingSchema } from "./billing";
import {
  merchantRoleNameSchema,
  tenantReadinessMissingReasonSchema,
  tenantStatusSchema,
} from "./tenant";

export const merchantDashboardSummarySchema = z.object({
  tenant: z.object({
    shopDetails: shopDetailsSchema.nullable().optional(),
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
    role: merchantRoleNameSchema,
    avatar: profileAvatarSchema.nullable().optional(),
    calendarPreference: userCalendarPreferenceSchema.optional(),
    supportAccess: z
      .object({ grantId: z.string().min(1), expiresAt: z.string().min(1) })
      .optional(),
  }),
  capabilities: z
    .array(
      z.enum([
        "billing",
        "customers",
        "domains",
        "editor",
        "inquiries",
        "insights",
        "media",
        "notifications",
        "orders",
        "payments",
        "products",
        "promotions",
        "settings",
        "storefront",
        "team",
      ]),
    )
    .optional(),
  permissions: z.array(z.string().regex(/^[a-z][a-z0-9_-]*\.[a-z][a-z0-9_-]*$/)).optional(),
  commerce: z.object({
    hasPublishableKey: z.boolean(),
    hasSalesChannel: z.boolean(),
    hasStore: z.boolean(),
  }),
  storefront: z.object({
    isPublished: z.boolean(),
    hasUnpublishedChanges: z.boolean().optional(),
    publishedRevisionId: z.string().min(1).nullable(),
    publishedTemplateKey: z.string().min(1).nullable().optional(),
    savedTemplateKeys: z.array(z.string().min(1)).optional(),
    templateId: z.string().min(1).nullable(),
    templateKey: z.string().min(1).nullable(),
    templateVersion: z.number().int().positive().nullable(),
  }),
  operations: z
    .object({
      range: z.object({
        label: z.string().min(1),
        days: z.number().int().positive().nullable(),
        sampledOrderCount: z.number().int().nonnegative(),
      }),
      quality: z.object({
        lastSuccessfulAt: z.string().min(1).nullable(),
        rollupVersion: z.number().int().positive(),
        status: z.enum(["fresh", "missing", "stale"]),
        timezone: z.string().min(1),
        watermark: z.string().min(1).nullable(),
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
      productStatuses: z
        .array(
          z.object({
            status: z.enum(["draft", "proposed", "published", "rejected"]),
            count: z.number().int().nonnegative(),
          }),
        )
        .nullable()
        .optional(),
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
      waitingOrders: z
        .array(
          z.object({
            id: z.string().min(1),
            customDisplayId: z.string().nullable(),
            customerName: z.string().nullable(),
            email: z.string().nullable(),
            total: z.number().nullable(),
            currencyCode: z.string().nullable(),
            createdAt: z.string().nullable(),
            reasons: z.array(z.enum(["fulfillment", "payment"])),
            productCount: z.number().int().nonnegative(),
            products: z.array(
              z.object({
                id: z.string(),
                title: z.string().nullable(),
                thumbnail: z.string().nullable(),
                quantity: z.number().nullable(),
              }),
            ),
          }),
        )
        .nullable()
        .optional(),
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
      funnel: z.array(
        z.object({
          count: z.number().int().nonnegative(),
          key: z.enum([
            "storefront_visits",
            "product_views",
            "add_to_cart",
            "checkout_started",
            "orders_created",
          ]),
        }),
      ),
      storefront: z
        .object({
          addToCartVisits: z.number().int().nonnegative(),
          checkoutVisits: z.number().int().nonnegative(),
          contactVisits: z.number().int().nonnegative(),
          pageViews: z.number().int().nonnegative(),
          productViewVisits: z.number().int().nonnegative(),
          searchVisits: z.number().int().nonnegative(),
          visits: z.number().int().nonnegative(),
        })
        .optional(),
      products: z
        .array(
          z.object({
            addToCartVisits: z.number().int().nonnegative(),
            productId: z.string().min(1),
            viewVisits: z.number().int().nonnegative(),
          }),
        )
        .optional(),
      provider: z
        .object({
          status: z.enum(["available", "not_configured", "unavailable"]),
          range: z.object({
            from: z.string().min(1),
            timezone: z.string().min(1),
            to: z.string().min(1),
          }),
          traffic: z
            .object({
              bounceRate: z.number().nonnegative().nullable(),
              pageViews: z.number().int().nonnegative(),
              visitDurationSeconds: z.number().nonnegative().nullable(),
              visitors: z.number().int().nonnegative(),
              visits: z.number().int().nonnegative(),
            })
            .nullable(),
          series: z.array(
            z.object({
              date: z.string().min(1),
              pageViews: z.number().int().nonnegative(),
              visits: z.number().int().nonnegative(),
            }),
          ),
          dimensions: z.object({
            country: z.array(z.object({ key: z.string(), visits: z.number().nonnegative() })),
            device: z.array(z.object({ key: z.string(), visits: z.number().nonnegative() })),
            path: z.array(z.object({ key: z.string(), visits: z.number().nonnegative() })),
            referrer: z.array(z.object({ key: z.string(), visits: z.number().nonnegative() })),
          }),
        })
        .optional(),
      coverage: z.object({
        lastEventAt: z.string().min(1).nullable(),
        status: z.enum(["no_data", "observed"]),
      }),
      unavailable: z.boolean(),
    })
    .optional(),
  billing: merchantDashboardBillingSchema.optional(),
});

export type MerchantDashboardSummary = z.infer<typeof merchantDashboardSummarySchema>;

/** Shell/auth payload only — no operations, analytics, or billing. */
export const merchantDashboardAccessSchema = merchantDashboardSummarySchema
  .pick({
    actor: true,
    capabilities: true,
    permissions: true,
    commerce: true,
    domain: true,
    storefront: true,
    tenant: true,
  })
  .extend({
    shopAccess: z.object({ accessibleCount: z.number().int().nonnegative() }).optional(),
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
