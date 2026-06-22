import type { createPlatformDb } from "@ecs/db";
import { tenantMemberships, users } from "@ecs/db";
import { and, eq } from "drizzle-orm";

import type { DashboardAuthorizationResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export function createDashboardAuthorizationLookup(db: PlatformDb) {
  return async function authorizeDashboardForTenant(input: {
    tenantId: string;
    userId: string;
  }): Promise<DashboardAuthorizationResult> {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: tenantMemberships.role,
      })
      .from(tenantMemberships)
      .innerJoin(users, eq(tenantMemberships.userId, users.id))
      .where(
        and(
          eq(tenantMemberships.tenantId, input.tenantId),
          eq(tenantMemberships.status, "active"),
          eq(users.id, input.userId),
          eq(users.status, "active"),
        ),
      )
      .limit(1);

    if (!row) {
      return { ok: false };
    }

    return {
      ok: true,
      actor: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
    };
  };
}
