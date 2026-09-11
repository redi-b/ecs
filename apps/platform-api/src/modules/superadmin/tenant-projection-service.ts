import type { SuperadminTenant } from "@ecs/contracts";
import type { createPlatformDb } from "@ecs/db";
import { domains, organizationMembers, tenants, users } from "@ecs/db";
import { and, count, desc, eq, ilike, min, or } from "drizzle-orm";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createSuperadminTenantProjectionService(db: PlatformDb) {
  const ownerProjection = db
    .select({
      organizationId: organizationMembers.organizationId,
      ownerEmail: min(users.email).as("owner_email"),
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(
      and(eq(organizationMembers.role, "owner"), eq(organizationMembers.status, "active")),
    )
    .groupBy(organizationMembers.organizationId)
    .as("tenant_owner");
  const projection = {
    id: tenants.id,
    name: tenants.name,
    handle: tenants.handle,
    ownerEmail: ownerProjection.ownerEmail,
    status: tenants.status,
    primaryDomainHostname: domains.hostname,
    createdAt: tenants.createdAt,
    updatedAt: tenants.updatedAt,
  };

  return {
    list: async (input: { limit: number; offset: number; query?: string | undefined }) => {
      const query = input.query?.trim().slice(0, 100);
      const filter = query
        ? or(
            ilike(tenants.name, `%${query}%`),
            ilike(tenants.handle, `%${query}%`),
            ilike(ownerProjection.ownerEmail, `%${query}%`),
          )
        : undefined;
      const rows = await db
        .select(projection)
        .from(tenants)
        .leftJoin(domains, eq(tenants.primaryDomainId, domains.id))
        .leftJoin(ownerProjection, eq(tenants.organizationId, ownerProjection.organizationId))
        .where(filter)
        .orderBy(desc(tenants.createdAt))
        .limit(input.limit)
        .offset(input.offset);
      const [total] = await db
        .select({ count: count() })
        .from(tenants)
        .leftJoin(ownerProjection, eq(tenants.organizationId, ownerProjection.organizationId))
        .where(filter);
      return {
        tenants: rows.map(serialize),
        count: total?.count ?? 0,
        limit: input.limit,
        offset: input.offset,
      };
    },
    get: async (input: { tenantId: string }) => {
      const [row] = await db
        .select(projection)
        .from(tenants)
        .leftJoin(domains, eq(tenants.primaryDomainId, domains.id))
        .leftJoin(ownerProjection, eq(tenants.organizationId, ownerProjection.organizationId))
        .where(and(eq(tenants.id, input.tenantId)))
        .limit(1);
      return row
        ? { ok: true as const, tenant: serialize(row) }
        : { ok: false as const, error: "tenant_not_found" as const };
    },
  };
}

function serialize(row: {
  id: string;
  name: string;
  handle: string;
  ownerEmail: string | null;
  status: SuperadminTenant["status"];
  primaryDomainHostname: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SuperadminTenant {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
