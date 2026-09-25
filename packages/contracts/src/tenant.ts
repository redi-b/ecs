import { z } from "zod";

import { shopDetailsSchema } from "./account";

/** ECS merchant permissions shared by authorization and every dashboard policy consumer. */
export const merchantPermissionActions = {
  team: ["create", "update", "delete", "read", "invite", "manage", "roles"],
  overview: ["read"],
  orders: ["read", "create", "update", "cancel", "refund", "export"],
  products: ["read", "create", "update", "publish", "delete", "import", "export"],
  customers: ["read", "update", "export"],
  inquiries: ["read", "update"],
  promotions: ["read", "manage"],
  media: ["read", "manage"],
  storefront: ["read", "edit", "publish"],
  insights: ["read"],
  notifications: ["read", "manage"],
  settings: ["read", "manage"],
  domains: ["manage"],
  payments: ["manage"],
  billing: ["read", "manage"],
  ownership: ["transfer"],
} as const;

export type MerchantPermission = {
  [Resource in keyof typeof merchantPermissionActions]: `${Resource}.${(typeof merchantPermissionActions)[Resource][number]}`;
}[keyof typeof merchantPermissionActions];

export const allMerchantPermissions = Object.entries(merchantPermissionActions).flatMap(
  ([resource, actions]) => actions.map((action) => `${resource}.${action}` as MerchantPermission),
);

export const tenantStatusSchema = z.enum(["draft", "active", "suspended", "cancelled"]);

export type TenantStatus = z.infer<typeof tenantStatusSchema>;

export const tenantMemberRoleSchema = z.enum(["owner", "manager", "staff", "operator"]);

export type TenantMemberRole = z.infer<typeof tenantMemberRoleSchema>;

export const merchantRoleNameSchema = z.string().trim().min(1).max(64);

export type MerchantRoleName = z.infer<typeof merchantRoleNameSchema>;

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
  role: merchantRoleNameSchema,
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
    phone: z.string().min(1).nullable().optional().default(null),
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
  shopDetails: shopDetailsSchema.optional(),
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
