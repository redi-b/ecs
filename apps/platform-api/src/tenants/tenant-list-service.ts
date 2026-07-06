import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  domains,
  reservedHandles,
  tenantMemberships,
  tenantProvisioningAttempts,
  tenants,
  users,
} from "@ecs/db";
import { and, count, desc, eq, ne, or } from "drizzle-orm";

import type {
  PlatformOnboardingStateResult,
  TenantDetailResult,
  TenantHandleAvailabilityResult,
  TenantListItem,
  TenantListResult,
  TenantShopSettingsUpdateResult,
} from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const handlePattern = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

type TenantMembershipRow = {
  id: string;
  name: string;
  handle: string;
  status: string;
  role: TenantListItem["role"];
  primaryDomainHostname: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toTenantListItem(row: TenantMembershipRow): TenantListItem {
  return {
    id: row.id,
    name: row.name,
    handle: row.handle,
    status: row.status,
    role: row.role,
    primaryDomain: {
      hostname: row.primaryDomainHostname,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeHandle(value: string) {
  return value.trim().toLowerCase();
}

function normalizeBaseDomain(value: string) {
  return value.trim().replace(/\.$/, "").toLowerCase();
}

function getPlatformHostname(handle: string, platformBaseDomain: string) {
  return `${handle}.${normalizeBaseDomain(platformBaseDomain)}`;
}

export function createTenantListService(db: PlatformDb) {
  return async function listTenantsForUser(input: {
    limit: number;
    offset: number;
    userId: string;
  }): Promise<TenantListResult> {
    const rows = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        handle: tenants.handle,
        status: tenants.status,
        role: tenantMemberships.role,
        primaryDomainHostname: domains.hostname,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .leftJoin(domains, eq(tenants.primaryDomainId, domains.id))
      .where(
        and(
          eq(tenantMemberships.userId, input.userId),
          eq(tenantMemberships.status, "active"),
          eq(users.status, "active"),
        ),
      )
      .orderBy(desc(tenants.createdAt))
      .limit(input.limit)
      .offset(input.offset);

    const [total] = await db
      .select({ count: count() })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenantMemberships.userId, input.userId),
          eq(tenantMemberships.status, "active"),
          eq(users.status, "active"),
        ),
      );

    return {
      ok: true,
      tenants: rows.map(toTenantListItem),
      count: total?.count ?? 0,
      limit: input.limit,
      offset: input.offset,
    };
  };
}

export function createTenantDetailService(db: PlatformDb) {
  return async function getTenantForUser(input: {
    tenantId: string;
    userId: string;
  }): Promise<TenantDetailResult> {
    const [row] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        handle: tenants.handle,
        status: tenants.status,
        role: tenantMemberships.role,
        primaryDomainHostname: domains.hostname,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .leftJoin(domains, eq(tenants.primaryDomainId, domains.id))
      .where(
        and(
          eq(tenants.id, input.tenantId),
          eq(tenantMemberships.userId, input.userId),
          eq(tenantMemberships.status, "active"),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    if (!row) {
      return {
        ok: false,
        error: "tenant_not_found",
        status: 404,
      };
    }

    return {
      ok: true,
      tenant: toTenantListItem(row),
    };
  };
}

export function createTenantHandleAvailabilityService(options: {
  db: PlatformDb;
  platformBaseDomain: string;
}) {
  return async function checkTenantHandleAvailability(input: {
    handle: string;
  }): Promise<TenantHandleAvailabilityResult> {
    const handle = normalizeHandle(input.handle);
    const responseHandle = handle || input.handle.trim().toLowerCase() || "shop";
    const hostname = getPlatformHostname(responseHandle, options.platformBaseDomain);

    if (!handlePattern.test(handle)) {
      return {
        available: false,
        handle: responseHandle,
        hostname,
        reason: "invalid",
      };
    }

    const [reservedHandle] = await options.db
      .select({ id: reservedHandles.id })
      .from(reservedHandles)
      .where(eq(reservedHandles.handle, handle))
      .limit(1);

    if (reservedHandle) {
      return {
        available: false,
        handle,
        hostname,
        reason: "reserved",
      };
    }

    const [existingTenant] = await options.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.handle, handle))
      .limit(1);

    if (existingTenant) {
      return {
        available: false,
        handle,
        hostname,
        reason: "taken",
      };
    }

    const [existingDomain] = await options.db
      .select({ id: domains.id })
      .from(domains)
      .where(eq(domains.hostname, hostname))
      .limit(1);

    if (existingDomain) {
      return {
        available: false,
        handle,
        hostname,
        reason: "taken",
      };
    }

    return {
      available: true,
      handle,
      hostname,
    };
  };
}

export function createPlatformOnboardingStateService(options: {
  db: PlatformDb;
  listTenantsForUser: (input: {
    limit: number;
    offset: number;
    userId: string;
  }) => Promise<TenantListResult>;
}) {
  return async function getOnboardingState(input: {
    userId: string;
  }): Promise<PlatformOnboardingStateResult> {
    const [user] = await options.db
      .select({
        email: users.email,
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      return {
        error: "auth_required",
        ok: false,
        status: 401,
      };
    }

    const tenantsResult = await options.listTenantsForUser({
      limit: 20,
      offset: 0,
      userId: input.userId,
    });
    const primaryTenant = tenantsResult.tenants.find((tenant) =>
      tenant.primaryDomain.hostname?.trim(),
    );

    const [attempt] = await options.db
      .select({
        error: tenantProvisioningAttempts.error,
        handle: tenantProvisioningAttempts.handle,
        id: tenantProvisioningAttempts.id,
        metadata: tenantProvisioningAttempts.metadata,
        status: tenantProvisioningAttempts.status,
        step: tenantProvisioningAttempts.step,
      })
      .from(tenantProvisioningAttempts)
      .where(eq(tenantProvisioningAttempts.ownerUserId, input.userId))
      .orderBy(desc(tenantProvisioningAttempts.createdAt))
      .limit(1);

    return {
      ok: true,
      state: {
        latestProvisioningAttempt: attempt
          ? {
              error: attempt.error,
              handle: attempt.handle,
              id: attempt.id,
              name: getRetryAttemptName(attempt.metadata, attempt.handle),
              status: attempt.status,
              step: attempt.step,
            }
          : null,
        primaryTenant: primaryTenant?.primaryDomain.hostname
          ? {
              dashboardUrl: `http://${primaryTenant.primaryDomain.hostname}/admin`,
              handle: primaryTenant.handle,
              id: primaryTenant.id,
              primaryDomain: primaryTenant.primaryDomain.hostname,
            }
          : null,
        tenants: tenantsResult.tenants,
        user,
      },
    };
  };
}

export function createTenantShopSettingsService(options: {
  db: PlatformDb;
  platformBaseDomain: string;
}) {
  return async function updateTenantShopSettings(input: {
    handle: string;
    name: string;
    tenantId: string;
    userId: string;
  }): Promise<TenantShopSettingsUpdateResult> {
    const handle = normalizeHandle(input.handle);
    const name = input.name.trim();

    if (name.length < 2) {
      return {
        ok: false,
        error: "tenant_name_invalid",
        status: 400,
      };
    }

    if (!handlePattern.test(handle)) {
      return {
        ok: false,
        error: "handle_invalid",
        status: 400,
      };
    }

    const [membership] = await options.db
      .select({
        id: tenants.id,
        currentHandle: tenants.handle,
      })
      .from(tenantMemberships)
      .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenants.id, input.tenantId),
          eq(tenantMemberships.userId, input.userId),
          eq(tenantMemberships.status, "active"),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    if (!membership) {
      return {
        ok: false,
        error: "tenant_not_found",
        status: 404,
      };
    }

    const [reservedHandle] = await options.db
      .select({ id: reservedHandles.id })
      .from(reservedHandles)
      .where(eq(reservedHandles.handle, handle))
      .limit(1);

    if (reservedHandle) {
      return {
        ok: false,
        error: "handle_reserved",
        status: 409,
      };
    }

    const [takenTenant] = await options.db
      .select({ id: tenants.id })
      .from(tenants)
      .where(and(eq(tenants.handle, handle), ne(tenants.id, input.tenantId)))
      .limit(1);

    if (takenTenant) {
      return {
        ok: false,
        error: "handle_unavailable",
        status: 409,
      };
    }

    const hostname = getPlatformHostname(handle, options.platformBaseDomain);
    const [takenDomain] = await options.db
      .select({ id: domains.id })
      .from(domains)
      .where(and(eq(domains.hostname, hostname), ne(domains.tenantId, input.tenantId)))
      .limit(1);

    if (takenDomain) {
      return {
        ok: false,
        error: "handle_unavailable",
        status: 409,
      };
    }

    const updated = await options.db.transaction(async (transaction) => {
      await transaction
        .update(tenants)
        .set({
          handle,
          name,
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, input.tenantId));

      await transaction
        .update(domains)
        .set({
          hostname,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(domains.tenantId, input.tenantId),
            or(eq(domains.type, "platform_subdomain"), eq(domains.type, "platform")),
          ),
        );

      await transaction.insert(auditLogs).values({
        actorUserId: input.userId,
        tenantId: input.tenantId,
        action: "tenant.settings_updated",
        targetType: "tenant",
        targetId: input.tenantId,
        metadata: {
          handle,
          name,
        },
      });

      const [row] = await transaction
        .select({
          id: tenants.id,
          name: tenants.name,
          handle: tenants.handle,
          status: tenants.status,
          role: tenantMemberships.role,
          primaryDomainHostname: domains.hostname,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
        })
        .from(tenantMemberships)
        .innerJoin(tenants, eq(tenantMemberships.tenantId, tenants.id))
        .innerJoin(users, eq(tenantMemberships.userId, users.id))
        .leftJoin(domains, eq(tenants.primaryDomainId, domains.id))
        .where(
          and(
            eq(tenants.id, input.tenantId),
            eq(tenantMemberships.userId, input.userId),
            eq(tenantMemberships.status, "active"),
            eq(users.status, "active"),
          ),
        )
        .limit(1);

      return row;
    });

    if (!updated) {
      return {
        ok: false,
        error: "tenant_not_found",
        status: 404,
      };
    }

    return {
      ok: true,
      tenant: toTenantListItem(updated),
      redirectTo: handle === membership.currentHandle ? null : `//${hostname}/admin/settings`,
    };
  };
}

function getRetryAttemptName(metadata: unknown, handle: string) {
  if (typeof metadata === "object" && metadata !== null && "name" in metadata) {
    const name = (metadata as { name?: unknown }).name;

    if (typeof name === "string" && name.trim()) {
      return name;
    }
  }

  return handle;
}
