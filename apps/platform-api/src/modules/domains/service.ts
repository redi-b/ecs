import { domainDiagnosticsSchema } from "@ecs/contracts";
import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  domainLifecycleEvents,
  domains,
  domainVerificationChallenges,
  tenants,
} from "@ecs/db";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import type {
  TenantDomain,
  TenantDomainCreateResult,
  TenantDomainListResult,
  TenantDomainPrimaryResult,
  TenantDomainVerificationResult,
} from "../../types/index.js";
import type { EntitlementDecision } from "../entitlements/service.js";
import {
  isReservedCustomDomainHostname,
  isValidCustomDomainHostname,
  normalizeCustomDomainHostname,
} from "./hostname.js";
import { DOMAIN_WARNING_GRACE_MS } from "./lifecycle.js";

export { isValidCustomDomainHostname, normalizeCustomDomainHostname } from "./hostname.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const DOMAIN_CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export function hasDomainOwnershipRecord(records: string[][], expected: string) {
  return records.some((chunks) => chunks.join("").trim() === expected);
}

export function createDomainManagementService(
  db: PlatformDb,
  options: {
    customDomainsAvailable?: boolean;
    platformBaseDomain?: string;
    ingressAddresses?: string[];
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

      if (
        !isValidCustomDomainHostname(hostname) ||
        isReservedCustomDomainHostname(hostname, options.platformBaseDomain)
      ) {
        return {
          ok: false,
          error: "domain_invalid",
          status: 400,
        };
      }

      return db.transaction(async (transaction): Promise<TenantDomainCreateResult> => {
        const lock = await transaction.execute(
          sql`select pg_try_advisory_xact_lock(hashtextextended('ecs:custom-domain-reconciliation:v1', 0)) as acquired`,
        );
        if (lock.rows[0]?.acquired !== true)
          return { ok: false, error: "domain_reconciliation_busy", status: 503 };
        const [existing] = await transaction
          .select()
          .from(domains)
          .where(and(eq(domains.hostname, hostname), isNull(domains.removedAt)))
          .limit(1);
        if (existing) {
          if (
            existing.tenantId !== input.tenantId ||
            existing.type !== "custom_domain" ||
            existing.status === "removing"
          )
            return { ok: false, error: "domain_unavailable", status: 409 };
          let [challenge] = await transaction
            .select({
              verifiedAt: domainVerificationChallenges.verifiedAt,
              recordName: domainVerificationChallenges.recordName,
              recordValue: domainVerificationChallenges.recordValue,
              expiresAt: domainVerificationChallenges.expiresAt,
            })
            .from(domainVerificationChallenges)
            .where(eq(domainVerificationChallenges.domainId, existing.id))
            .orderBy(desc(domainVerificationChallenges.createdAt))
            .limit(1);
          // Repeating the claim renews only an expired initial setup challenge.
          // Connected challenges survive their initial TTL and are never rotated
          // by replay, including while DNS/TXT recovery is in progress.
          if (
            existing.activatedAt === null &&
            (!challenge ||
              (challenge.verifiedAt === null && challenge.expiresAt.getTime() <= Date.now()))
          ) {
            const expiresAt = new Date(Date.now() + DOMAIN_CHALLENGE_TTL_MS);
            [challenge] = await transaction
              .insert(domainVerificationChallenges)
              .values({
                domainId: existing.id,
                recordName: `_ecs-verification.${hostname}`,
                recordValue: `ecs-domain-verification=${crypto.randomUUID()}`,
                expiresAt,
              })
              .returning({
                verifiedAt: domainVerificationChallenges.verifiedAt,
                recordName: domainVerificationChallenges.recordName,
                recordValue: domainVerificationChallenges.recordValue,
                expiresAt: domainVerificationChallenges.expiresAt,
              });
            if (!challenge) throw new Error("Domain challenge renewal returned no rows.");
            await transaction
              .update(domains)
              .set({
                status: "pending_verification",
                verificationStatus: "pending",
                sslStatus: "pending",
                warningSince: null,
                warningReason: null,
                updatedAt: new Date(),
              })
              .where(and(eq(domains.id, existing.id), eq(domains.tenantId, input.tenantId)));
            existing.status = "pending_verification";
            existing.verificationStatus = "pending";
            existing.sslStatus = "pending";
            const metadata = {
              recordName: challenge.recordName,
              expiresAt: expiresAt.toISOString(),
            };
            await transaction.insert(domainLifecycleEvents).values({
              domainId: existing.id,
              tenantId: input.tenantId,
              event: "ownership_challenge_reissued",
              metadata,
            });
            await transaction.insert(auditLogs).values({
              actorUserId: input.userId,
              tenantId: input.tenantId,
              action: "domain.ownership_challenge_reissued",
              targetType: "domain",
              targetId: existing.id,
              metadata,
            });
          }
          return {
            ok: true,
            domain: {
              id: existing.id,
              hostname: existing.hostname,
              type: existing.type,
              status: existing.status,
              isPrimary: existing.isPrimary,
              verificationStatus: existing.verificationStatus,
              sslStatus: existing.sslStatus,
              verificationChallenge: challenge
                ? {
                    recordName: challenge.recordName,
                    recordValue: challenge.recordValue,
                    expiresAt: challenge.expiresAt.toISOString(),
                  }
                : null,
            },
          };
        }
        const claims = await transaction
          .select({ id: domains.id })
          .from(domains)
          .where(
            and(
              eq(domains.tenantId, input.tenantId),
              eq(domains.type, "custom_domain"),
              isNull(domains.removedAt),
            ),
          )
          .limit(2);
        if (claims.length >= 2) return { ok: false, error: "domain_limit_reached", status: 409 };
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
          ok: true,
          domain: {
            ...createdDomain,
            verificationChallenge: {
              ...challenge,
              expiresAt: challenge.expiresAt.toISOString(),
            },
          },
        };
      });
    },
    verifyTenantDomainOwnership: async (input: {
      domainId: string;
      tenantId: string;
      userId: string;
    }): Promise<TenantDomainVerificationResult> => {
      const readChallenge = async (executor: Pick<PlatformDb, "select">) =>
        executor
          .select({
            challengeId: domainVerificationChallenges.id,
            verifiedAt: domainVerificationChallenges.verifiedAt,
            expiresAt: domainVerificationChallenges.expiresAt,
            id: domains.id,
            hostname: domains.hostname,
            type: domains.type,
            status: domains.status,
            isPrimary: domains.isPrimary,
            verificationStatus: domains.verificationStatus,
            sslStatus: domains.sslStatus,
            recordName: domainVerificationChallenges.recordName,
            recordValue: domainVerificationChallenges.recordValue,
          })
          .from(domains)
          .innerJoin(
            domainVerificationChallenges,
            eq(domainVerificationChallenges.domainId, domains.id),
          )
          .where(
            and(
              eq(domains.id, input.domainId),
              eq(domains.tenantId, input.tenantId),
              eq(domains.type, "custom_domain"),
            ),
          )
          .orderBy(desc(domainVerificationChallenges.createdAt))
          .limit(1);
      const [row] = await readChallenge(db);
      if (!row) return { ok: false, error: "domain_not_found", status: 404 };
      if (row.status === "removing") return { ok: false, error: "domain_not_found", status: 404 };
      const previouslyVerified = row.verifiedAt !== null;
      if (!previouslyVerified && row.expiresAt.getTime() <= Date.now()) {
        return { ok: false, error: "domain_verification_expired", status: 409 };
      }

      const records = await options?.resolveTxt?.(row.recordName).catch(() => []);
      if (!hasDomainOwnershipRecord(records ?? [], row.recordValue)) {
        return { ok: false, error: "domain_verification_pending", status: 409 };
      }

      return db.transaction(async (transaction): Promise<TenantDomainVerificationResult> => {
        const lock = await transaction.execute<{ acquired: boolean }>(
          sql`select pg_try_advisory_xact_lock(hashtextextended('ecs:custom-domain-reconciliation:v1', 0)) as acquired`,
        );
        if (lock.rows[0]?.acquired !== true) {
          return { ok: false, error: "domain_reconciliation_busy", status: 503 };
        }
        // DNS is external and slow. Apply its evidence only to the same current
        // claim, under the lock shared by removal and route publication.
        const [current] = await readChallenge(transaction);
        if (!current || current.status === "removing") {
          return { ok: false, error: "domain_not_found", status: 404 };
        }
        if (
          current.challengeId !== row.challengeId ||
          current.hostname !== row.hostname ||
          current.recordName !== row.recordName ||
          current.recordValue !== row.recordValue
        ) {
          return { ok: false, error: "domain_verification_pending", status: 409 };
        }
        // The TTL bounds initial claims, not persistent connected ownership.
        // Replays return current readiness without mutating lifecycle/audit.
        if (current.verifiedAt !== null) {
          const { id, hostname, type, status, isPrimary, verificationStatus, sslStatus } = current;
          return {
            ok: true,
            domain: { id, hostname, type, status, isPrimary, verificationStatus, sslStatus },
          };
        }
        if (current.expiresAt.getTime() <= Date.now()) {
          return { ok: false, error: "domain_verification_expired", status: 409 };
        }
        const now = new Date();
        await transaction
          .update(domainVerificationChallenges)
          .set({ verifiedAt: now })
          .where(eq(domainVerificationChallenges.id, row.challengeId));
        const [updated] = await transaction
          .update(domains)
          .set({ verificationStatus: "verified", status: "pending_dns", updatedAt: now })
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
        return { ok: true, domain: updated };
      });
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
          lastCheckedAt: domains.lastCheckedAt,
          lastCheckReason: domains.lastCheckReason,
          lastCheckDetail: domains.lastCheckDetail,
          warningSince: domains.warningSince,
        })
        .from(domains)
        .where(and(eq(domains.tenantId, input.tenantId), isNull(domains.removedAt)))
        .orderBy(desc(domains.isPrimary), asc(domains.hostname));

      const domainsWithChallenges: TenantDomain[] = await Promise.all(
        rows.map(
          async ({
            lastCheckedAt,
            lastCheckReason,
            lastCheckDetail,
            warningSince,
            ...storedDomain
          }) => {
            const parsedDiagnostic = domainDiagnosticsSchema.safeParse({
              checkedAt: lastCheckedAt?.toISOString(),
              reason: lastCheckReason,
              detail: lastCheckDetail,
            });
            const domain = {
              ...storedDomain,
              diagnostics: parsedDiagnostic.success ? parsedDiagnostic.data : null,
              warningGraceExpiresAt: warningSince
                ? new Date(warningSince.getTime() + DOMAIN_WARNING_GRACE_MS).toISOString()
                : null,
            };
            if (domain.type !== "custom_domain") {
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
          },
        ),
      );

      return {
        ok: true,
        domains: domainsWithChallenges,
        setup: {
          enabled: options.customDomainsAvailable === true,
          entitled: (
            await options.evaluateEntitlement({ tenantId: input.tenantId, key: "customDomains" })
          ).allowed,
          dnsTarget: `domains.${options.platformBaseDomain ?? "ecset.dev"}`,
          ingressIpv4: options.ingressAddresses ?? [],
        },
      };
    },
    setTenantPrimaryDomain: async (input: {
      domainId: string;
      tenantId: string;
      userId: string;
    }): Promise<TenantDomainPrimaryResult> => {
      return db.transaction(async (transaction): Promise<TenantDomainPrimaryResult> => {
        const lock = await transaction.execute(
          sql`select pg_try_advisory_xact_lock(hashtextextended('ecs:custom-domain-reconciliation:v1', 0)) as acquired`,
        );
        if (lock.rows[0]?.acquired !== true)
          return { ok: false, error: "domain_reconciliation_busy", status: 503 };
        const [domain] = await transaction
          .select({
            id: domains.id,
            hostname: domains.hostname,
            type: domains.type,
            status: domains.status,
            isPrimary: domains.isPrimary,
            verificationStatus: domains.verificationStatus,
            sslStatus: domains.sslStatus,
            activatedAt: domains.activatedAt,
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
          domain.sslStatus !== "active" ||
          (domain.type === "custom_domain" &&
            (options.customDomainsAvailable !== true ||
              !domain.activatedAt ||
              !Number.isFinite(domain.activatedAt.getTime()) ||
              domain.activatedAt.getTime() < 0 ||
              domain.activatedAt.getTime() > Date.now() ||
              !(
                await options.evaluateEntitlement({
                  key: "customDomains",
                  tenantId: input.tenantId,
                })
              ).allowed))
        ) {
          return {
            ok: false,
            error: "domain_not_verified",
            status: 409,
          };
        }

        if (domain.isPrimary) {
          const { activatedAt: _activatedAt, ...current } = domain;
          return { ok: true, domain: current };
        }
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

        return { ok: true, domain: updatedDomain };
      });
    },
  };
}
