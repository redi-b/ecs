import {
  customDomainLifecycleStatusSchema,
  type DomainDiagnostics,
  domainDiagnosticsSchema,
} from "@ecs/contracts";
import {
  auditLogs,
  type createPlatformDb,
  domainLifecycleEvents,
  domains,
  domainVerificationChallenges,
  tenants,
} from "@ecs/db";
import { and, asc, desc, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { type DomainLifecycleEvidence, decideDomainLifecycle } from "./lifecycle.js";
import { canPublishDomainRoute } from "./route-eligibility.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
type Transaction = Parameters<Parameters<PlatformDb["transaction"]>[0]>[0];
type Domain = typeof domains.$inferSelect;
function matchesObservation(row: Domain, observed: Domain) {
  return Object.entries(row).every(([key, value]) => {
    const previous = observed[key as keyof Domain];
    return value instanceof Date
      ? previous instanceof Date && value.getTime() === previous.getTime()
      : value === previous;
  });
}

async function recordCheckEvent(
  transaction: Transaction,
  row: Domain,
  diagnostic: DomainDiagnostics,
) {
  if (row.lastCheckReason === diagnostic.reason && row.lastCheckDetail === diagnostic.detail)
    return;
  const metadata = { reason: diagnostic.reason, detail: diagnostic.detail };
  await transaction.insert(domainLifecycleEvents).values({
    domainId: row.id,
    tenantId: row.tenantId,
    event: "check_result_changed",
    metadata,
  });
  await transaction.insert(auditLogs).values({
    tenantId: row.tenantId,
    action: "domain.check_result_changed",
    targetType: "domain",
    targetId: row.id,
    metadata,
  });
}
export type ReconciliationApplyInput = {
  domainId: string;
  tenantId: string;
  evidence: DomainLifecycleEvidence;
  now: number;
  // Required by probe orchestration; omitted only by synchronous internal callers.
  expectedDomain?: Domain;
};
export type ReconciliationApplyResult =
  | { ok: false; error: "domain_not_found" | "domain_changed" }
  | { ok: true; domain: Domain; changed: boolean; routeDesired: boolean; admitStorefront: boolean };

function storeFor(transaction: Transaction) {
  return {
    recordDiagnostic: async (input: {
      domainId: string;
      tenantId: string;
      expectedDomain: Domain;
      diagnostic: DomainDiagnostics;
    }) => {
      const diagnostic = domainDiagnosticsSchema.parse(input.diagnostic);
      const [row] = await transaction
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.id, input.domainId),
            eq(domains.tenantId, input.tenantId),
            eq(domains.type, "custom_domain"),
          ),
        )
        .for("update");
      if (!row) return { ok: false as const, error: "domain_not_found" as const };
      if (row.status === "removing" || !matchesObservation(row, input.expectedDomain))
        return { ok: false as const, error: "domain_changed" as const };
      await transaction
        .update(domains)
        .set({
          lastCheckedAt: new Date(diagnostic.checkedAt),
          lastCheckReason: diagnostic.reason,
          lastCheckDetail: diagnostic.detail,
          updatedAt: new Date(diagnostic.checkedAt),
        })
        .where(and(eq(domains.id, row.id), eq(domains.tenantId, row.tenantId)));
      await recordCheckEvent(transaction, row, diagnostic);
      return { ok: true as const };
    },
    // Caller must first confirm the complete desired routing snapshot under
    // this lock. Keep immutable historical identities; release only live claims.
    finalizeRemovals: async (now: number) => {
      const rows = await transaction
        .update(domains)
        .set({ removedAt: new Date(now), updatedAt: new Date(now) })
        .where(
          and(
            eq(domains.type, "custom_domain"),
            eq(domains.status, "removing"),
            isNull(domains.removedAt),
          ),
        )
        .returning({ id: domains.id, tenantId: domains.tenantId, hostname: domains.hostname });
      for (const row of rows) {
        const metadata = { hostname: row.hostname, reason: "routing_withdrawal_confirmed" };
        await transaction.insert(domainLifecycleEvents).values({
          domainId: row.id,
          tenantId: row.tenantId,
          event: "removal_completed",
          metadata,
        });
        await transaction.insert(auditLogs).values({
          tenantId: row.tenantId,
          action: "domain.removal_completed",
          targetType: "domain",
          targetId: row.id,
          metadata,
        });
      }
      return rows.length;
    },
    markRemoving: async (input: {
      domainId: string;
      tenantId: string;
      userId: string;
      now: number;
    }) => {
      const [row] = await transaction
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.id, input.domainId),
            eq(domains.tenantId, input.tenantId),
            eq(domains.type, "custom_domain"),
          ),
        )
        .for("update");
      if (!row) return { ok: false as const, error: "domain_not_found" as const };
      // Repair the tenant pointer even on replay. Never clear another domain
      // selected since the original removal request.
      await transaction
        .update(tenants)
        .set({ primaryDomainId: null, updatedAt: new Date(input.now) })
        .where(and(eq(tenants.id, row.tenantId), eq(tenants.primaryDomainId, row.id)));
      if (row.status === "removing") return { ok: true as const, changed: false };
      // Commit admission denial before publishing. A later provider failure
      // must leave a durable removal request, not revive storefront access.
      await transaction
        .update(domains)
        .set({
          status: "removing",
          isPrimary: false,
          updatedAt: new Date(input.now),
        })
        .where(and(eq(domains.id, row.id), eq(domains.tenantId, row.tenantId)));
      const metadata = { from: row.status, to: "removing", reason: "merchant_requested" };
      await transaction.insert(domainLifecycleEvents).values({
        domainId: row.id,
        tenantId: row.tenantId,
        event: "removal_requested",
        metadata,
      });
      await transaction.insert(auditLogs).values({
        tenantId: row.tenantId,
        actorUserId: input.userId,
        action: "domain.removal_requested",
        targetType: "domain",
        targetId: row.id,
        metadata,
      });
      return { ok: true as const, changed: true };
    },
    // Read under the same lock used for publication and merchant removal. Never
    // build a route snapshot from an earlier unlocked probe's candidate list.
    // Caller must additionally gate runtime availability and current entitlement.
    listRouteDomains: async (
      now: number,
    ): Promise<Pick<Domain, "id" | "tenantId" | "hostname">[]> => {
      const rows = await transaction
        .select({ domain: domains })
        .from(domains)
        .innerJoin(tenants, eq(tenants.id, domains.tenantId))
        .where(and(eq(domains.type, "custom_domain"), eq(tenants.status, "active")))
        .orderBy(asc(domains.hostname));
      return rows
        .filter(({ domain }) => canPublishDomainRoute(domain, now))
        .map(({ domain }) => ({
          id: domain.id,
          tenantId: domain.tenantId,
          hostname: domain.hostname,
        }));
    },
    apply: async (input: ReconciliationApplyInput): Promise<ReconciliationApplyResult> => {
      const [row] = await transaction
        .select()
        .from(domains)
        .where(
          and(
            eq(domains.id, input.domainId),
            eq(domains.tenantId, input.tenantId),
            eq(domains.type, "custom_domain"),
          ),
        )
        .for("update");
      if (!row) return { ok: false, error: "domain_not_found" };
      if (input.expectedDomain && !matchesObservation(row, input.expectedDomain)) {
        return { ok: false, error: "domain_changed" };
      }
      const decision = decideDomainLifecycle(
        {
          status: customDomainLifecycleStatusSchema.parse(row.status),
          activatedAt: row.activatedAt?.getTime() ?? null,
          failureSince: row.warningSince?.getTime() ?? null,
          httpsVerified: row.sslStatus === "active",
        },
        input.evidence,
        input.now,
      );
      const next = {
        status: decision.status,
        activatedAt: decision.activatedAt === null ? null : new Date(decision.activatedAt),
        warningSince: decision.failureSince === null ? null : new Date(decision.failureSince),
        warningReason: decision.status === "misconfigured" ? decision.reason : null,
        sslStatus:
          input.evidence.https === "not_observed"
            ? row.sslStatus
            : input.evidence.https === "valid"
              ? "active"
              : "pending",
        // During an established warning preserve admitted ownership history;
        // persistent TXT health is separately expressed by the warning reason.
        verificationStatus: input.evidence.ownership
          ? "verified"
          : row.activatedAt
            ? row.verificationStatus
            : "pending",
      };
      const changed =
        row.status !== next.status ||
        row.sslStatus !== next.sslStatus ||
        row.verificationStatus !== next.verificationStatus ||
        row.warningReason !== next.warningReason ||
        row.activatedAt?.getTime() !== next.activatedAt?.getTime() ||
        row.warningSince?.getTime() !== next.warningSince?.getTime();
      const [updated] = await transaction
        .update(domains)
        .set({
          ...next,
          updatedAt: new Date(input.now),
          lastCheckedAt: new Date(input.now),
          lastCheckReason: decision.reason,
          lastCheckDetail: null,
        })
        .where(and(eq(domains.id, input.domainId), eq(domains.tenantId, input.tenantId)))
        .returning();
      if (!updated) throw new Error("Locked domain update returned no row.");
      if (!changed) {
        await recordCheckEvent(transaction, row, {
          checkedAt: new Date(input.now).toISOString(),
          reason: decision.reason,
          detail: null,
        });
        return {
          ok: true,
          domain: updated,
          changed: false,
          routeDesired: decision.routeDesired,
          admitStorefront: decision.admitStorefront,
        };
      }
      const metadata = {
        from: row.status,
        to: next.status,
        reason: decision.reason,
        routeDesired: decision.routeDesired,
        admitStorefront: decision.admitStorefront,
        evidence: input.evidence,
      };
      await transaction.insert(domainLifecycleEvents).values({
        domainId: row.id,
        tenantId: row.tenantId,
        event: "readiness_reconciled",
        metadata,
      });
      await transaction.insert(auditLogs).values({
        tenantId: row.tenantId,
        action: "domain.readiness_reconciled",
        targetType: "domain",
        targetId: row.id,
        metadata,
      });
      return {
        ok: true,
        domain: updated,
        changed: true,
        routeDesired: decision.routeDesired,
        admitStorefront: decision.admitStorefront,
      };
    },
  };
}

export function createDomainReconciliationRepository(db: PlatformDb) {
  return {
    listReconciliationPage: async (cursor?: string) =>
      db
        .select({ id: domains.id, tenantId: domains.tenantId })
        .from(domains)
        .innerJoin(tenants, eq(tenants.id, domains.tenantId))
        .where(
          and(
            eq(domains.type, "custom_domain"),
            eq(tenants.status, "active"),
            ne(domains.status, "removing"),
            cursor ? gt(domains.id, cursor) : undefined,
          ),
        )
        .orderBy(asc(domains.id))
        .limit(100),
    findProbeCandidate: async (input: { domainId: string; tenantId: string }) => {
      const [candidate] = await db
        .select({
          domain: domains,
          ownershipValue: domainVerificationChallenges.recordValue,
          verifiedAt: domainVerificationChallenges.verifiedAt,
        })
        .from(domains)
        .innerJoin(tenants, eq(tenants.id, domains.tenantId))
        .innerJoin(
          domainVerificationChallenges,
          eq(domainVerificationChallenges.domainId, domains.id),
        )
        .where(
          and(
            eq(domains.id, input.domainId),
            eq(domains.tenantId, input.tenantId),
            eq(domains.type, "custom_domain"),
            eq(tenants.status, "active"),
            ne(domains.status, "removing"),
          ),
        )
        .orderBy(desc(domainVerificationChallenges.createdAt))
        .limit(1);
      // Expiry bounds the initial claim only. A verified persistent challenge is
      // rechecked on every pass, including automatic recovery after TXT breakage.
      return candidate?.verifiedAt ? candidate : undefined;
    },
    runExclusive: async <T>(
      operation: (store: ReturnType<typeof storeFor>) => Promise<T>,
    ): Promise<{ acquired: false } | { acquired: true; value: T }> =>
      db.transaction(async (transaction) => {
        const result = await transaction.execute(
          sql`select pg_try_advisory_xact_lock(hashtextextended('ecs:custom-domain-reconciliation:v1', 0)) as acquired`,
        );
        if (result.rows[0]?.acquired !== true) return { acquired: false };
        return { acquired: true, value: await operation(storeFor(transaction)) };
      }),
  };
}
