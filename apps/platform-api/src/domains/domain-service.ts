import type { createPlatformDb } from "@ecs/db";
import { auditLogs, domains } from "@ecs/db";
import { asc, desc, eq } from "drizzle-orm";

import type { TenantDomain, TenantDomainCreateResult, TenantDomainListResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])$/;

export function normalizeCustomDomainHostname(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}

export function isValidCustomDomainHostname(value: string) {
  if (!hostnamePattern.test(value)) {
    return false;
  }

  return !value.split(".").some((label) => label.startsWith("-") || label.endsWith("-"));
}

export function createDomainManagementService(db: PlatformDb) {
  return {
    createTenantDomain: async (input: {
      hostname: string;
      tenantId: string;
      userId: string;
    }): Promise<TenantDomainCreateResult> => {
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

        return createdDomain;
      });

      return {
        ok: true,
        domain,
      };
    },
    listTenantDomains: async (input: { tenantId: string }): Promise<TenantDomainListResult> => {
      const rows: TenantDomain[] = await db
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

      return {
        ok: true,
        domains: rows,
      };
    },
  };
}
