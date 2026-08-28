import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { createPlatformDb, entitlementOverrides, plans, subscriptions, tenants } from "@ecs/db";
import { eq, sql } from "drizzle-orm";

import { createEntitlementService } from "./service.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

describe("entitlement service with PostgreSQL", { skip: !connectionString }, () => {
  const tenantId = randomUUID();
  const planId = randomUUID();
  const overrideId = randomUUID();
  const database = createPlatformDb({ connectionString: connectionString ?? "" });

  before(async () => {
    await database.db.insert(tenants).values({
      id: tenantId,
      handle: `entitlement-${tenantId.slice(0, 8)}`,
      name: "Entitlement Integration",
    });
    await database.db.insert(plans).values({
      id: planId,
      name: "Integration Growth",
      price: "2499",
      features: { customDomains: true },
    });
    await database.db.insert(subscriptions).values({
      tenantId,
      planId,
      status: "active",
      manualPaymentState: "paid",
    });
  });

  after(async () => {
    await database.db
      .delete(entitlementOverrides)
      .where(eq(entitlementOverrides.tenantId, tenantId));
    await database.db.delete(subscriptions).where(eq(subscriptions.tenantId, tenantId));
    await database.db.delete(plans).where(eq(plans.id, planId));
    await database.db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.pool.end();
  });

  it("evaluates plan, override expiry, and billing state against migrated tables", async () => {
    const service = createEntitlementService(database.db);
    assert.deepEqual(await service.evaluate({ key: "customDomains", tenantId }), {
      allowed: true,
      key: "customDomains",
      source: "plan",
      subscriptionStatus: "active",
    });

    await database.db.insert(entitlementOverrides).values({
      id: overrideId,
      tenantId,
      key: "customDomains",
      value: false,
      reason: "Integration denial",
      grantedByUserId: "integration_operator",
      expiresAt: new Date(Date.now() + 60_000),
    });
    assert.equal((await service.evaluate({ key: "customDomains", tenantId })).allowed, false);

    await database.db
      .update(entitlementOverrides)
      .set({ expiresAt: new Date(Date.now() - 1_000) })
      .where(eq(entitlementOverrides.id, overrideId));
    assert.equal((await service.evaluate({ key: "customDomains", tenantId })).source, "plan");

    await database.db
      .update(subscriptions)
      .set({ status: "past_due" })
      .where(eq(subscriptions.tenantId, tenantId));
    assert.equal(
      (await service.evaluate({ key: "customDomains", tenantId })).source,
      "subscription",
    );
  });

  it("rejects a permanent override at the database boundary", async () => {
    await assert.rejects(
      database.db.execute(sql`
        insert into entitlement_overrides
          (tenant_id, key, value, reason, granted_by_user_id, expires_at)
        values
          (${tenantId}, 'customDomains', 'true'::jsonb, 'invalid permanent override',
           'integration_operator', null)
      `),
      (error: unknown) => {
        const cause =
          error && typeof error === "object" && "cause" in error
            ? (error.cause as { code?: unknown })
            : null;
        return cause?.code === "23502";
      },
    );
  });
});
