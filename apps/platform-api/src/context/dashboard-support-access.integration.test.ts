import assert from "node:assert/strict";
import test from "node:test";

import {
  createPlatformDb,
  platformPrincipals,
  tenantSupportAccessGrants,
  tenants,
  users,
} from "@ecs/db";
import { eq } from "drizzle-orm";

import { createDashboardAuthorizationLookup } from "./dashboard-authorization.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

test(
  "support grants are tenant scoped and deny expired, revoked, or disabled authority",
  { skip: connectionString ? false : "PLATFORM_AUTH_INTEGRATION_DATABASE_URL is not set" },
  async () => {
    const { db, pool } = createPlatformDb({ connectionString: connectionString as string, max: 1 });
    const suffix = Date.now().toString(36);
    const userId = `support-operator-${suffix}`;
    try {
      await db.insert(users).values({
        id: userId,
        name: "Support Operator",
        email: `${userId}@example.test`,
      });
      const [principal] = await db
        .insert(platformPrincipals)
        .values({ userId })
        .returning({ id: platformPrincipals.id });
      const [tenantA, tenantB] = await db
        .insert(tenants)
        .values([
          { handle: `support-a-${suffix}`, name: "Support A" },
          { handle: `support-b-${suffix}`, name: "Support B" },
        ])
        .returning({ id: tenants.id });
      assert.ok(principal && tenantA && tenantB);
      const [grant] = await db
        .insert(tenantSupportAccessGrants)
        .values({
          expiresAt: new Date(Date.now() + 60 * 60_000),
          operatorUserId: userId,
          platformPrincipalId: principal.id,
          reason: "Investigating integration support case",
          tenantId: tenantA.id,
        })
        .returning({ id: tenantSupportAccessGrants.id });
      assert.ok(grant);

      const authorize = createDashboardAuthorizationLookup(db);
      const allowed = await authorize({ tenantId: tenantA.id, userId });
      assert.equal(allowed.ok, true);
      assert.equal(allowed.ok ? allowed.actor.supportAccess?.grantId : null, grant.id);
      assert.equal((await authorize({ tenantId: tenantB.id, userId })).ok, false);

      await db
        .update(tenantSupportAccessGrants)
        .set({ expiresAt: new Date(Date.now() - 1_000) })
        .where(eq(tenantSupportAccessGrants.id, grant.id));
      assert.equal((await authorize({ tenantId: tenantA.id, userId })).ok, false);

      await db
        .update(tenantSupportAccessGrants)
        .set({ expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() })
        .where(eq(tenantSupportAccessGrants.id, grant.id));
      assert.equal((await authorize({ tenantId: tenantA.id, userId })).ok, false);

      await db
        .update(tenantSupportAccessGrants)
        .set({ revokedAt: null })
        .where(eq(tenantSupportAccessGrants.id, grant.id));
      await db
        .update(platformPrincipals)
        .set({ status: "disabled" })
        .where(eq(platformPrincipals.id, principal.id));
      assert.equal((await authorize({ tenantId: tenantA.id, userId })).ok, false);
    } finally {
      await pool.end();
    }
  },
);
