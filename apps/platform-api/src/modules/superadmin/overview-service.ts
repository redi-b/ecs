import type { SuperadminOverview } from "@ecs/contracts";
import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  invoices,
  paymentOnboarding,
  tenantProvisioningAttempts,
  tenantSupportAccessGrants,
  tenants,
  users,
} from "@ecs/db";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, lt } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type Merchant = SuperadminOverview["attention"][number]["merchant"];

export function createSuperadminOverviewService(db: PlatformDb) {
  return async (input: { now?: Date; limit?: number } = {}): Promise<SuperadminOverview> => {
    const now = input.now ?? new Date();
    const limit = Math.min(Math.max(input.limit ?? 8, 1), 25);
    const merchantProjection = {
      merchantId: tenants.id,
      merchantName: tenants.name,
      merchantHandle: tenants.handle,
    };

    const [
      merchantCounts,
      suspended,
      suspendedCount,
      paymentReviews,
      paymentReviewCount,
      dueInvoices,
      dueInvoiceCount,
      supportAccess,
    ] = await Promise.all([
      db.select({ status: tenants.status, count: count() }).from(tenants).groupBy(tenants.status),
      db
        .select({ ...merchantProjection, occurredAt: tenants.updatedAt })
        .from(tenants)
        .where(eq(tenants.status, "suspended"))
        .orderBy(desc(tenants.updatedAt))
        .limit(limit),
      db.select({ count: count() }).from(tenants).where(eq(tenants.status, "suspended")),
      db
        .select({ ...merchantProjection, id: paymentOnboarding.id })
        .from(paymentOnboarding)
        .innerJoin(tenants, eq(paymentOnboarding.tenantId, tenants.id))
        .where(eq(paymentOnboarding.status, "pending_review"))
        .limit(limit),
      db
        .select({ count: count() })
        .from(paymentOnboarding)
        .where(eq(paymentOnboarding.status, "pending_review")),
      db
        .select({ ...merchantProjection, id: invoices.id, occurredAt: invoices.dueAt })
        .from(invoices)
        .innerJoin(tenants, eq(invoices.tenantId, tenants.id))
        .where(and(eq(invoices.status, "pending"), lt(invoices.dueAt, now)))
        .orderBy(desc(invoices.dueAt))
        .limit(limit),
      db
        .select({ count: count() })
        .from(invoices)
        .where(and(eq(invoices.status, "pending"), lt(invoices.dueAt, now))),
      db
        .select({ count: count() })
        .from(tenantSupportAccessGrants)
        .where(
          and(
            isNull(tenantSupportAccessGrants.revokedAt),
            gt(tenantSupportAccessGrants.expiresAt, now),
          ),
        ),
    ]);

    const latestProvisioning = await db
      .selectDistinctOn([tenantProvisioningAttempts.platformTenantId], {
        id: tenantProvisioningAttempts.id,
        platformTenantId: tenantProvisioningAttempts.platformTenantId,
        status: tenantProvisioningAttempts.status,
        occurredAt: tenantProvisioningAttempts.createdAt,
      })
      .from(tenantProvisioningAttempts)
      .orderBy(
        tenantProvisioningAttempts.platformTenantId,
        desc(tenantProvisioningAttempts.createdAt),
      );
    const failedLatest = latestProvisioning.filter((attempt) => attempt.status === "failed");
    const failedTenantIds = failedLatest.map((attempt) => attempt.platformTenantId);
    const failedMerchants = failedTenantIds.length
      ? await db
          .select(merchantProjection)
          .from(tenants)
          .where(inArray(tenants.id, failedTenantIds))
      : [];
    const failedMerchantById = new Map(
      failedMerchants.map((row) => [row.merchantId, toMerchant(row)]),
    );

    const attention: SuperadminOverview["attention"] = [
      ...suspended.map((row) => ({
        id: `merchant:${row.merchantId}`,
        kind: "merchant_suspended" as const,
        merchant: toMerchant(row),
        occurredAt: row.occurredAt.toISOString(),
      })),
      ...paymentReviews.map((row) => ({
        id: `payment:${row.id}`,
        kind: "payment_review" as const,
        merchant: toMerchant(row),
        occurredAt: null,
      })),
      ...dueInvoices.map((row) => ({
        id: `invoice:${row.id}`,
        kind: "billing_due" as const,
        merchant: toMerchant(row),
        occurredAt: row.occurredAt?.toISOString() ?? null,
      })),
      ...failedLatest.flatMap((row) => {
        const merchant = failedMerchantById.get(row.platformTenantId);
        return merchant
          ? [
              {
                id: `provisioning:${row.id}`,
                kind: "provisioning_failed" as const,
                merchant,
                occurredAt: row.occurredAt.toISOString(),
              },
            ]
          : [];
      }),
    ]
      .sort((left, right) => dateValue(right.occurredAt) - dateValue(left.occurredAt))
      .slice(0, limit);

    const recentActivity = await db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        actorName: users.name,
        merchantId: tenants.id,
        merchantName: tenants.name,
        merchantHandle: tenants.handle,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorUserId, users.id))
      .leftJoin(tenants, eq(auditLogs.tenantId, tenants.id))
      .where(isNotNull(auditLogs.platformPrincipalId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);

    const counts = new Map(merchantCounts.map((row) => [row.status, row.count]));
    const merchants = merchantCounts.reduce((sum, row) => sum + row.count, 0);
    const attentionItems =
      (suspendedCount[0]?.count ?? 0) +
      (paymentReviewCount[0]?.count ?? 0) +
      (dueInvoiceCount[0]?.count ?? 0) +
      failedMerchants.length;

    return {
      summary: {
        merchants,
        activeMerchants: counts.get("active") ?? 0,
        attentionItems,
        activeSupportAccess: supportAccess[0]?.count ?? 0,
      },
      attention,
      recentActivity: recentActivity.map((row) => ({
        id: row.id,
        action: row.action,
        actorName: row.actorName,
        merchant:
          row.merchantId && row.merchantName && row.merchantHandle
            ? { id: row.merchantId, name: row.merchantName, handle: row.merchantHandle }
            : null,
        createdAt: row.createdAt.toISOString(),
      })),
      generatedAt: now.toISOString(),
    };
  };
}

function toMerchant(row: {
  merchantId: string;
  merchantName: string;
  merchantHandle: string;
}): Merchant {
  return { id: row.merchantId, name: row.merchantName, handle: row.merchantHandle };
}

function dateValue(value: string | null) {
  return value ? Date.parse(value) : 0;
}
