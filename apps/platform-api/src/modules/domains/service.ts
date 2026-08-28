import { isIP } from "node:net";
import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  domainLifecycleEvents,
  domains,
  domainVerificationChallenges,
  tenants,
} from "@ecs/db";
import { and, asc, desc, eq } from "drizzle-orm";

import type {
  TenantDomain,
  TenantDomainCreateResult,
  TenantDomainListResult,
  TenantDomainPrimaryResult,
  TenantDomainVerificationResult,
} from "../../types/index.js";
import type { EntitlementDecision } from "../entitlements/service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const DOMAIN_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/;

export function normalizeCustomDomainHostname(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}

export function isValidCustomDomainHostname(value: string) {
  if (!hostnamePattern.test(value) || isIP(value) !== 0) {
    return false;
  }

  return !value.split(".").some((label) => label.startsWith("-") || label.endsWith("-"));
}

export function hasDomainOwnershipRecord(records: string[][], expected: string) {
  return records.flat().some((value) => value.trim() === expected);
}

export function createDomainManagementService(
  db: PlatformDb,
  options: {
    customDomainsAvailable?: boolean;
    evaluateEntitlement: (input: {
      key: "customDomains";
      tenantId: string;
    }) => Promise<EntitlementDecision>;
    resolveTxt?: (hostname: string) => Promise<string[][]>;
  },
) {
  if (typeof options?.evaluateEntitlement !== "function") {
    throw new Error("Domain management requires evaluateEntitlement.");
  }

  return {
    createTenantDomain: async (input: {
      hostname: string;
      tenantId: string;
      userId: string;
    }): Promise<TenantDomainCreateResult> => {
      if (options.customDomainsAvailable !== true) {
        return {
          ok: false,
          error: "custom_domains_unavailable",
          status: 503,
        };
      }

      const entitlement = await options.evaluateEntitlement({
        key: "customDomains",
        tenantId: input.tenantId,
      });

      if (!entitlement.allowed) {
        return {
          ok: false,
          error: "entitlement_required",
          status: 403,
        };
      }

      const hostname = normalizeCustomDomainHostname(input.hostname);

      if (!isValidCustomDomainHostname(hostname)) {
        return {
          ok: false,
          error: "domain_invalid",
          status: 400,
        };
      }

      const [existingDomain] = await db
        .select({ id: domains.id })
        .from(domains)
        .where(eq(domains.hostname, hostname))
        .limit(1);

      if (existingDomain) {
        return {
          ok: false,
          error: "domain_unavailable",
          status: 409,
        };
      }

      const domain = await db.transaction(async (transaction) => {
        const [createdDomain] = await transaction
          .insert(domains)
          .values({
            tenantId: input.tenantId,
            hostname,
            type: "custom_domain",
            status: "pending_verification",
            isPrimary: false,
            verificationStatus: "pending",
            sslStatus: "pending",
          })
          .returning({
            id: domains.id,
            hostname: domains.hostname,
            type: domains.type,
            status: domains.status,
            isPrimary: domains.isPrimary,
            verificationStatus: domains.verificationStatus,
            sslStatus: domains.sslStatus,
          });

        if (!createdDomain) {
          throw new Error("Domain insert returned no rows.");
        }

        const expiresAt = new Date(Date.now() + DOMAIN_CHALLENGE_TTL_MS);
        const [challenge] = await transaction
          .insert(domainVerificationChallenges)
          .values({
            domainId: createdDomain.id,
            recordName: `_ecs-verification.${hostname}`,
            recordValue: `ecs-domain-verification=${crypto.randomUUID()}`,
            expiresAt,
          })
          .returning({
            expiresAt: domainVerificationChallenges.expiresAt,
            recordName: domainVerificationChallenges.recordName,
            recordValue: domainVerificationChallenges.recordValue,
          });
        if (!challenge) throw new Error("Domain challenge insert returned no rows.");

        await transaction.insert(domainLifecycleEvents).values({
          domainId: createdDomain.id,
          tenantId: input.tenantId,
          event: "ownership_challenge_created",
          metadata: { expiresAt: expiresAt.toISOString(), recordName: challenge.recordName },
        });

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "domain.created",
          targetType: "domain",
          targetId: createdDomain.id,
          metadata: {
            hostname,
            type: "custom_domain",
          },
        });

        return {
          ...createdDomain,
          verificationChallenge: {
            ...challenge,
            expiresAt: challenge.expiresAt.toISOString(),
          },
        };
      });

      return {
        ok: true,
        domain,
      };
    },
    verifyTenantDomainOwnership: async (input: {
      domainId: string;
      tenantId: string;
      userId: string;
    }): Promise<TenantDomainVerificationResult> => {
      const [row] = await db
        .select({
          challengeId: domainVerificationChallenges.id,
          expiresAt: domainVerificationChallenges.expiresAt,
          hostname: domains.hostname,
          recordName: domainVerificationChallenges.recordName,
          recordValue: domainVerificationChallenges.recordValue,
        })
        .from(domains)
        .innerJoin(
          domainVerificationChallenges,
          eq(domainVerificationChallenges.domainId, domains.id),
        )
        .where(and(eq(domains.id, input.domainId), eq(domains.tenantId, input.tenantId)))
        .orderBy(desc(domainVerificationChallenges.createdAt))
        .limit(1);
      if (!row) return { ok: false, error: "domain_not_found", status: 404 };
      if (row.expiresAt.getTime() <= Date.now()) {
        return { ok: false, error: "domain_verification_expired", status: 409 };
      }

      const records = await options?.resolveTxt?.(row.recordName).catch(() => []);
      if (!hasDomainOwnershipRecord(records ?? [], row.recordValue)) {
        return { ok: false, error: "domain_verification_pending", status: 409 };
      }

      const domain = await db.transaction(async (transaction) => {
        const now = new Date();
        await transaction
          .update(domainVerificationChallenges)
          .set({ verifiedAt: now })
          .where(eq(domainVerificationChallenges.id, row.challengeId));
        const [updated] = await transaction
          .update(domains)
          .set({ verificationStatus: "verified", status: "pending_certificate", updatedAt: now })
          .where(and(eq(domains.id, input.domainId), eq(domains.tenantId, input.tenantId)))
          .returning({
            id: domains.id,
            hostname: domains.hostname,
            type: domains.type,
            status: domains.status,
            isPrimary: domains.isPrimary,
            verificationStatus: domains.verificationStatus,
            sslStatus: domains.sslStatus,
          });
        if (!updated) throw new Error("Verified domain update returned no rows.");
        await transaction.insert(domainLifecycleEvents).values({
          domainId: updated.id,
          tenantId: input.tenantId,
          event: "ownership_verified",
          metadata: { recordName: row.recordName },
        });
        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "domain.ownership_verified",
          targetType: "domain",
          targetId: updated.id,
          metadata: { hostname: updated.hostname },
        });
        return updated;
      });
      return { ok: true, domain };
    },
    listTenantDomains: async (input: { tenantId: string }): Promise<TenantDomainListResult> => {
      const rows = await db
        .select({
          id: domains.id,
          hostname: domains.hostname,
          type: domains.type,
          status: domains.status,
          isPrimary: domains.isPrimary,
          verificationStatus: domains.verificationStatus,
          sslStatus: domains.sslStatus,
        })
        .from(domains)
        .where(eq(domains.tenantId, input.tenantId))
        .orderBy(desc(domains.isPrimary), asc(domains.hostname));

      const domainsWithChallenges: TenantDomain[] = await Promise.all(
        rows.map(async (domain) => {
          if (domain.type !== "custom_domain" || domain.verificationStatus === "verified") {
            return domain;
          }
          const [challenge] = await db
            .select({
              expiresAt: domainVerificationChallenges.expiresAt,
              recordName: domainVerificationChallenges.recordName,
              recordValue: domainVerificationChallenges.recordValue,
            })
            .from(domainVerificationChallenges)
            .where(eq(domainVerificationChallenges.domainId, domain.id))
            .orderBy(desc(domainVerificationChallenges.createdAt))
            .limit(1);
          return {
            ...domain,
            verificationChallenge: challenge
              ? {
                  ...challenge,
                  expiresAt: challenge.expiresAt.toISOString(),
                }
              : null,
          };
        }),
      );

      return {
        ok: true,
        domains: domainsWithChallenges,
      };
    },
    setTenantPrimaryDomain: async (input: {
      domainId: string;
      tenantId: string;
      userId: string;
    }): Promise<TenantDomainPrimaryResult> => {
      const [domain] = await db
        .select({
          id: domains.id,
          hostname: domains.hostname,
          type: domains.type,
          status: domains.status,
          isPrimary: domains.isPrimary,
          verificationStatus: domains.verificationStatus,
          sslStatus: domains.sslStatus,
        })
        .from(domains)
        .where(and(eq(domains.id, input.domainId), eq(domains.tenantId, input.tenantId)))
        .limit(1);

      if (!domain) {
        return {
          ok: false,
          error: "domain_not_found",
          status: 404,
        };
      }

      if (
        domain.status !== "active" ||
        domain.verificationStatus !== "verified" ||
        domain.sslStatus !== "active"
      ) {
        return {
          ok: false,
          error: "domain_not_verified",
          status: 409,
        };
      }

      const primaryDomain = await db.transaction(async (transaction) => {
        await transaction
          .update(domains)
          .set({
            isPrimary: false,
            updatedAt: new Date(),
          })
          .where(eq(domains.tenantId, input.tenantId));

        const [updatedDomain] = await transaction
          .update(domains)
          .set({
            isPrimary: true,
            updatedAt: new Date(),
          })
          .where(and(eq(domains.id, input.domainId), eq(domains.tenantId, input.tenantId)))
          .returning({
            id: domains.id,
            hostname: domains.hostname,
            type: domains.type,
            status: domains.status,
            isPrimary: domains.isPrimary,
            verificationStatus: domains.verificationStatus,
            sslStatus: domains.sslStatus,
          });

        if (!updatedDomain) {
          throw new Error("Primary domain update returned no rows.");
        }

        await transaction
          .update(tenants)
          .set({
            primaryDomainId: input.domainId,
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, input.tenantId));

        await transaction.insert(auditLogs).values({
          actorUserId: input.userId,
          tenantId: input.tenantId,
          action: "domain.primary_changed",
          targetType: "domain",
          targetId: updatedDomain.id,
          metadata: {
            hostname: updatedDomain.hostname,
          },
        });

        return updatedDomain;
      });

      return {
        ok: true,
        domain: primaryDomain,
      };
    },
  };
}
