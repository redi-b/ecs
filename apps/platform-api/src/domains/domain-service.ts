import type { createPlatformDb } from "@ecs/db";
import { auditLogs, domains, tenants } from "@ecs/db";
import { and, asc, desc, eq } from "drizzle-orm";

import type {
  TenantDomain,
  TenantDomainCreateResult,
  TenantDomainListResult,
  TenantDomainPrimaryResult,
} from "../app.js";

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
