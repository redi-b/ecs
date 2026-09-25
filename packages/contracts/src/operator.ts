import { z } from "zod";

import { profileAvatarSchema } from "./account";

export const superadminEntitlementSummarySchema = z.object({
  entitlement: z.object({
    allowed: z.boolean(),
    key: z.literal("customDomains"),
    source: z.enum(["override", "plan", "subscription", "missing"]),
    subscriptionStatus: z.string().min(1).nullable(),
  }),
  overrides: z.array(
    z.object({
      id: z.string().min(1),
      value: z.boolean(),
      reason: z.string().min(1),
      expiresAt: z.string().min(1).nullable(),
      revokedAt: z.string().min(1).nullable(),
      createdAt: z.string().min(1),
    }),
  ),
});
export type SuperadminEntitlementSummary = z.infer<typeof superadminEntitlementSummarySchema>;

export const superadminOperationalSummarySchema = z.object({
  readiness: z.object({
    ready: z.boolean(),
    missing: z.array(z.string()),
    tenantReady: z.boolean(),
    domainReady: z.boolean(),
    commerceReady: z.boolean(),
    storefrontReady: z.boolean(),
    provisioningReady: z.boolean(),
  }),
  storefront: z.object({ hasDraft: z.boolean(), isPublished: z.boolean() }),
  domains: z.object({
    total: z.number().int().nonnegative(),
    custom: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    primaryHostname: z.string().min(1).nullable(),
  }),
  billing: z.object({
    available: z.boolean(),
    planName: z.string().min(1).nullable(),
    subscriptionStatus: z.string().min(1).nullable(),
    pendingInvoiceCount: z.number().int().nonnegative(),
  }),
  payments: z.object({
    total: z.number().int().nonnegative(),
    pendingReview: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
  }),
});
export type SuperadminOperationalSummary = z.infer<typeof superadminOperationalSummarySchema>;

export const superadminCommerceReviewSchema = z.object({
  billing: z
    .object({
      planName: z.string().min(1),
      planVersionId: z.string().min(1).nullable(),
      subscriptionStatus: z.string().min(1),
      billingCycle: z.string().min(1),
      currentPeriodEnd: z.string().min(1).nullable(),
      invoices: z.array(
        z.object({
          id: z.string().min(1),
          amount: z.string().min(1),
          currency: z.string().min(1),
          status: z.string().min(1),
          dueAt: z.string().min(1).nullable(),
          paidAt: z.string().min(1).nullable(),
          provider: z.string().min(1).nullable(),
          providerReference: z.string().min(1).nullable(),
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
    })
    .nullable(),
  paymentOnboarding: z
    .array(
      z.object({
        id: z.string().min(1),
        provider: z.string().min(1),
        status: z.string().min(1),
        requiredDocuments: z.array(z.string().min(1)),
        notes: z.string().nullable(),
        providerAccountRef: z.string().nullable(),
      }),
    )
    .nullable(),
});
export type SuperadminCommerceReview = z.infer<typeof superadminCommerceReviewSchema>;

export const superadminOverviewSchema = z.object({
  summary: z.object({
    merchants: z.number().int().nonnegative(),
    activeMerchants: z.number().int().nonnegative(),
    attentionItems: z.number().int().nonnegative(),
    activeSupportAccess: z.number().int().nonnegative(),
  }),
  attention: z.array(
    z.object({
      id: z.string().min(1),
      kind: z.enum(["billing_due", "merchant_suspended", "payment_review", "provisioning_failed"]),
      merchant: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        handle: z.string().min(1),
      }),
      occurredAt: z.string().min(1).nullable(),
    }),
  ),
  recentActivity: z.array(
    z.object({
      id: z.string().min(1),
      action: z.string().min(1),
      actorName: z.string().min(1).nullable(),
      merchant: z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          handle: z.string().min(1),
        })
        .nullable(),
      createdAt: z.string().min(1),
    }),
  ),
  generatedAt: z.string().min(1),
});
export type SuperadminOverview = z.infer<typeof superadminOverviewSchema>;

export const operatorWorkListSchema = z.object({
  kind: z.enum(["shop_setup", "background_job"]),
  items: z.array(
    z.discriminatedUnion("kind", [
      z.object({
        kind: z.literal("shop_setup"),
        id: z.string().min(1),
        merchantName: z.string().min(1),
        handle: z.string().min(1),
        step: z.string().min(1),
        failureCategory: z.enum([
          "authentication",
          "configuration",
          "network",
          "rate_limit",
          "timeout",
          "validation",
          "unknown",
        ]),
        createdAt: z.string().min(1),
        retryable: z.boolean(),
      }),
      z.object({
        kind: z.literal("background_job"),
        id: z.string().min(1),
        jobName: z.string().min(1),
        merchant: z
          .object({ id: z.string().min(1), name: z.string().min(1), handle: z.string().min(1) })
          .nullable(),
        attempts: z.number().int().nonnegative(),
        maxAttempts: z.number().int().positive(),
        failureCategory: z.enum([
          "authentication",
          "configuration",
          "network",
          "rate_limit",
          "timeout",
          "validation",
          "unknown",
        ]),
        finishedAt: z.string().min(1),
      }),
    ]),
  ),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type OperatorWorkList = z.infer<typeof operatorWorkListSchema>;

export const operatorBillingPaymentReviewListSchema = z.object({
  items: z.array(
    z.object({
      amount: z.string().min(1),
      createdAt: z.string().min(1),
      currency: z.string().min(1),
      evidenceId: z.string().min(1),
      invoiceId: z.string().min(1),
      provider: z.string().min(1),
      reference: z.string().min(1),
      tenantHandle: z.string().min(1),
      tenantId: z.string().min(1),
      tenantName: z.string().min(1),
      verificationSource: z.string().nullable(),
    }),
  ),
  count: z.number().int().nonnegative(),
});
export type OperatorBillingPaymentReviewList = z.infer<
  typeof operatorBillingPaymentReviewListSchema
>;

export const operatorAuditListSchema = z.object({
  events: z.array(
    z.object({
      id: z.string().min(1),
      action: z.string().min(1),
      correlationId: z.string().uuid(),
      outcome: z.enum(["accepted", "completed", "failed", "unknown"]),
      actor: z
        .object({ id: z.string().min(1), name: z.string().min(1), email: z.string().email() })
        .nullable(),
      merchant: z
        .object({ id: z.string().min(1), name: z.string().min(1), handle: z.string().min(1) })
        .nullable(),
      targetType: z.string().min(1),
      targetId: z.string().min(1).nullable(),
      createdAt: z.string().min(1),
    }),
  ),
  count: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type OperatorAuditList = z.infer<typeof operatorAuditListSchema>;

export const platformOperatorListSchema = z.object({
  operators: z.array(
    z.object({
      principalId: z.string().min(1),
      userId: z.string().min(1),
      name: z.string().min(1),
      email: z.string().email(),
      status: z.string().min(1),
      permissions: z.array(z.string().min(1)),
      access: z.array(
        z.object({ permission: z.string().min(1), expiresAt: z.string().min(1).nullable() }),
      ),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1),
    }),
  ),
});
export type PlatformOperatorList = z.infer<typeof platformOperatorListSchema>;

export const operatorHealthSchema = z.object({
  status: z.enum(["clear", "attention"]),
  dependencies: z.array(
    z.object({
      id: z.enum([
        "platform_database",
        "commerce_backend",
        "storefront_runtime",
        "job_queue",
        "media_storage",
      ]),
      status: z.enum(["operational", "unavailable", "not_configured"]),
      evidence: z.enum(["request", "live_check"]),
      checkedAt: z.string().min(1),
      latencyMs: z.number().int().nonnegative().nullable(),
    }),
  ),
  backgroundWork: z.object({
    queued: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    failedLast24Hours: z.number().int().nonnegative(),
    oldestQueuedAt: z.string().min(1).nullable(),
    types: z.array(
      z.object({
        name: z.string().min(1),
        queued: z.number().int().nonnegative(),
        active: z.number().int().nonnegative(),
        failedLast24Hours: z.number().int().nonnegative(),
        lastCompletedAt: z.string().min(1).nullable(),
      }),
    ),
  }),
  notifications: z.object({
    pending: z.number().int().nonnegative(),
    retrying: z.number().int().nonnegative(),
    failedLast24Hours: z.number().int().nonnegative(),
    channels: z.array(
      z.object({
        channel: z.string().min(1),
        pending: z.number().int().nonnegative(),
        retrying: z.number().int().nonnegative(),
        failedLast24Hours: z.number().int().nonnegative(),
        lastSentAt: z.string().min(1).nullable(),
      }),
    ),
  }),
  media: z.object({
    pending: z.number().int().nonnegative(),
    processing: z.number().int().nonnegative(),
    ready: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  merchants: z.object({
    active: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    suspended: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
  generatedAt: z.string().min(1),
});
export type OperatorHealth = z.infer<typeof operatorHealthSchema>;

export const operatorJobOperationsSchema = z.object({
  scheduler: z
    .object({ buildVersion: z.string().min(1), lastSeenAt: z.string().min(1) })
    .nullable(),
  queues: z.array(
    z.object({
      queue: z.enum(["critical", "default", "bulk"]),
      counts: z.object({
        active: z.number().int().nonnegative(),
        delayed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        paused: z.number().int().nonnegative(),
        prioritized: z.number().int().nonnegative(),
        waiting: z.number().int().nonnegative(),
      }),
      oldestWaitingAt: z.string().min(1).nullable(),
      workers: z.array(
        z.object({
          buildVersion: z.string().min(1),
          lastSeenAt: z.string().min(1),
          workerId: z.string().min(1),
        }),
      ),
    }),
  ),
  runs: z.array(
    z.object({
      id: z.string().uuid(),
      tenantId: z.string().uuid().nullable(),
      name: z.string().min(1),
      status: z.enum(["queued", "active", "completed", "failed", "cancelled"]),
      errorCode: z.string().min(1).nullable(),
      attempts: z.number().int().nonnegative(),
      maxAttempts: z.number().int().positive(),
      bullmqJobId: z.string().nullable(),
      queuedAt: z.string().min(1),
      startedAt: z.string().min(1).nullable(),
      finishedAt: z.string().min(1).nullable(),
      createdAt: z.string().min(1),
      updatedAt: z.string().min(1),
      canCancel: z.boolean(),
      canRetry: z.boolean(),
    }),
  ),
});
export type OperatorJobOperations = z.infer<typeof operatorJobOperationsSchema>;

const safeFailureCategorySchema = z.enum([
  "authentication",
  "configuration",
  "network",
  "rate_limit",
  "timeout",
  "validation",
  "unknown",
]);

export const superadminDiagnosticsSchema = z.object({
  jobs: z.object({
    recentFailures: z.array(
      z.object({
        category: z.enum([
          "billing",
          "analytics",
          "notification",
          "provisioning",
          "integration",
          "other",
        ]),
        failureCategory: safeFailureCategorySchema,
        attempts: z.number().int().nonnegative(),
        maxAttempts: z.number().int().nonnegative(),
        createdAt: z.string().min(1),
        finishedAt: z.string().min(1).nullable(),
      }),
    ),
  }),
  notifications: z.object({
    recentFailures: z.array(
      z.object({
        channel: z.enum(["email", "telegram", "other"]),
        eventType: z.string().min(1).max(64),
        failureCategory: safeFailureCategorySchema,
        createdAt: z.string().min(1),
      }),
    ),
  }),
  media: z.object({
    total: z.number().int().nonnegative(),
    pending: z.number().int().nonnegative(),
    ready: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    recentFailures: z.array(
      z.object({ failureCategory: safeFailureCategorySchema, createdAt: z.string().min(1) }),
    ),
  }),
});
export type SuperadminDiagnostics = z.infer<typeof superadminDiagnosticsSchema>;

export const superadminSupportHistorySchema = z.object({
  history: z.object({
    notes: z.array(
      z.object({
        id: z.string().min(1),
        operatorUserId: z.string().min(1),
        operator: z
          .object({ id: z.string().min(1), name: z.string().min(1), email: z.string().email() })
          .nullable(),
        body: z.string().min(1),
        visibility: z.literal("internal"),
        createdAt: z.string().min(1),
      }),
    ),
    auditLogs: z.array(
      z.object({
        id: z.string().min(1),
        actorUserId: z.string().nullable(),
        actor: z
          .object({ id: z.string().min(1), name: z.string().min(1), email: z.string().email() })
          .nullable(),
        action: z.string().min(1),
        targetType: z.string().min(1),
        targetId: z.string().nullable(),
        createdAt: z.string().min(1),
      }),
    ),
  }),
});
export type SuperadminSupportHistory = z.infer<typeof superadminSupportHistorySchema>;

export const superadminSupportAccessSchema = z.object({
  grants: z.array(
    z.object({
      id: z.string().min(1),
      operatorUserId: z.string().min(1),
      reason: z.string().min(1),
      expiresAt: z.string().min(1),
      revokedAt: z.string().min(1).nullable(),
      revokeReason: z.string().nullable(),
      createdAt: z.string().min(1),
    }),
  ),
});
export type SuperadminSupportAccess = z.infer<typeof superadminSupportAccessSchema>;

export const superadminMerchantTeamSchema = z.object({
  invitations: z.array(
    z.object({
      createdAt: z.string().min(1),
      email: z.string().email(),
      expiresAt: z.string().min(1),
      id: z.string().min(1),
      role: z.string().min(1),
    }),
  ),
  members: z.array(
    z.object({
      createdAt: z.string().min(1),
      email: z.string().email(),
      id: z.string().min(1),
      image: z.string().nullable(),
      avatar: profileAvatarSchema.nullable().optional(),
      name: z.string().min(1),
      role: z.string().min(1),
      status: z.string().min(1),
      userId: z.string().min(1),
    }),
  ),
  roles: z.array(
    z.object({
      createdAt: z.string().min(1),
      id: z.string().min(1),
      permission: z.record(z.string(), z.array(z.string())),
      role: z.string().min(1),
      updatedAt: z.string().nullable(),
    }),
  ),
});
export type SuperadminMerchantTeam = z.infer<typeof superadminMerchantTeamSchema>;
