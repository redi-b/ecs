import { z } from "zod";

/**
 * Dedicated billing status (GET /platform/tenants/:tenantId/billing).
 * Same plan/sub/invoice shape as dashboard.billing, without the unavailable flag
 * (dedicated route returns 4xx instead).
 */
export const ENTITLEMENT_KEYS = ["customDomains"] as const;
export const entitlementKeySchema = z.enum(ENTITLEMENT_KEYS);
export type EntitlementKey = z.infer<typeof entitlementKeySchema>;

export const entitlementDecisionSchema = z.object({
  allowed: z.boolean(),
  key: entitlementKeySchema,
  source: z.enum(["override", "plan", "subscription", "missing"]),
  subscriptionStatus: z.string().min(1).nullable(),
});
export type EntitlementDecisionContract = z.infer<typeof entitlementDecisionSchema>;

export const merchantBillingStatusSchema = z.object({
  entitlements: z.record(entitlementKeySchema, entitlementDecisionSchema).optional(),
  subscription: z
    .object({
      id: z.string().min(1),
      planVersionId: z.string().min(1).nullable(),
      status: z.string().min(1),
      billingCycle: z.string().min(1),
      manualPaymentState: z.string().min(1),
      currentPeriodStart: z.string().min(1).nullable(),
      currentPeriodEnd: z.string().min(1).nullable(),
      renewalPlanVersionId: z.string().min(1).nullable().optional(),
      renewalEffectiveAt: z.string().min(1).nullable().optional(),
      renewalPlanName: z.string().min(1).nullable().optional(),
      renewalPlanPrice: z.string().min(1).nullable().optional(),
      trialStartedAt: z.string().min(1).nullable().optional(),
      trialEndsAt: z.string().min(1).nullable().optional(),
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
      paymentEvidence: z
        .object({
          id: z.string().min(1),
          provider: z.string().min(1),
          reference: z.string().min(1),
          status: z.string().min(1),
          createdAt: z.string().min(1),
          reviewReason: z.string().nullable().optional(),
          verificationSource: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
  paymentDestinations: z
    .array(
      z.object({
        provider: z.string().min(1),
        label: z.string().min(1),
        accountName: z.string().min(1),
        accountNumber: z.string().min(1),
      }),
    )
    .optional(),
  availablePaidPlans: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        price: z.string().min(1),
        limits: z.unknown(),
        features: z.unknown(),
        trial: z
          .object({
            available: z.boolean(),
            durationDays: z.number().int().positive().optional(),
            versionId: z.string().min(1).optional(),
          })
          .optional(),
        publicName: z.string().nullable().optional(),
        summary: z.string().nullable().optional(),
        featureList: z.array(z.string()).optional(),
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
        limits: z.unknown(),
        features: z.unknown(),
        trial: z
          .object({
            available: z.boolean(),
            durationDays: z.number().int().positive().optional(),
            versionId: z.string().min(1).optional(),
          })
          .optional(),
        publicName: z.string().nullable().optional(),
        summary: z.string().nullable().optional(),
        featureList: z.array(z.string()).optional(),
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

export const planTrialPolicySchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    activation: z.enum(["automatic", "manual"]),
    durationDays: z.number().int().min(1).max(365),
    eligibilityScope: z.enum(["tenant", "account"]),
    enabled: z.literal(true),
    fallbackPlanVersionId: z.string().min(1),
    paymentMethodRequired: z.boolean(),
  }),
]);

export const publicPlanCatalogSchema = z.object({
  plans: z.array(
    z.object({
      badge: z.string().nullable(),
      billingInterval: z.enum(["day", "week", "month", "year"]),
      code: z.string().min(1),
      ctaLabel: z.string().min(1),
      description: z.string(),
      displayOrder: z.number().int().nonnegative(),
      featureList: z.array(z.string().min(1)),
      featured: z.boolean(),
      name: z.string().min(1),
      price: z.string().min(1),
      currency: z.string().min(1),
      summary: z.string(),
      trial: z.discriminatedUnion("available", [
        z.object({ available: z.literal(false) }),
        z.object({
          activation: z.enum(["automatic", "manual"]),
          available: z.literal(true),
          durationDays: z.number().int().positive(),
          paymentMethodRequired: z.boolean(),
        }),
      ]),
    }),
  ),
});
export type PublicPlanCatalog = z.infer<typeof publicPlanCatalogSchema>;

const operatorPlanVersionSummarySchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  name: z.string().min(1),
  price: z.string().min(1),
  currency: z.string().min(1),
  billingInterval: z.string().min(1),
  publishedAt: z.string().min(1),
  trialPolicy: planTrialPolicySchema,
});

export const operatorPlanCatalogSchema = z.object({
  plans: z.array(
    z.object({
      id: z.string().min(1),
      code: z.string().min(1),
      kind: z.enum(["standard", "custom"]),
      visibility: z.enum(["public", "private"]),
      tenantId: z.string().min(1).nullable(),
      basePlanVersionId: z.string().min(1).nullable(),
      name: z.string().min(1),
      price: z.string().min(1),
      status: z.string().min(1),
      features: z.unknown(),
      limits: z.unknown(),
      subscriptionCount: z.number().int().nonnegative(),
      latestVersion: operatorPlanVersionSummarySchema
        .extend({ features: z.unknown(), limits: z.unknown() })
        .nullable(),
      versions: z.array(operatorPlanVersionSummarySchema),
      draft: z
        .object({
          id: z.string().min(1),
          revision: z.number().int().positive(),
          name: z.string().min(1),
          price: z.string().min(1),
          currency: z.string().min(1),
          billingInterval: z.string().min(1),
          features: z.unknown(),
          limits: z.unknown(),
          trialPolicy: planTrialPolicySchema,
          updatedAt: z.string().min(1),
        })
        .nullable(),
      presentation: z
        .object({
          badge: z.string().nullable(),
          ctaLabel: z.string().min(1),
          description: z.string(),
          displayOrder: z.number().int().nonnegative(),
          featureList: z.unknown(),
          featured: z.boolean(),
          landingVisible: z.boolean(),
          publicName: z.string().min(1),
          summary: z.string(),
          updatedAt: z.string().min(1),
        })
        .nullable(),
    }),
  ),
});
export type OperatorPlanCatalog = z.infer<typeof operatorPlanCatalogSchema>;
export type MerchantBillingResponse = z.infer<typeof merchantBillingResponseSchema>;
