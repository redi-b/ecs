import type { createPlatformDb } from "@ecs/db";
import { domains, tenantMemberships, tenants, users } from "@ecs/db";
import { and, count, desc, eq } from "drizzle-orm";

import type { TenantDetailResult, TenantListItem, TenantListResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

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
