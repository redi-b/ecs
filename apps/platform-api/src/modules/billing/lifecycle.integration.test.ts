import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import {
  billingOutboxEvents,
  createPlatformDb,
  invoices,
  plans,
  planVersions,
  subscriptions,
  tenants,
} from "@ecs/db";
import { and, eq } from "drizzle-orm";

import { createBillingOutbox } from "./outbox.js";
import { createBillingService } from "./service.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

describe("billing lifecycle with PostgreSQL", { skip: !connectionString }, () => {
  const tenantId = randomUUID();
  const planId = randomUUID();
  const planVersionId = randomUUID();
  const subscriptionId = randomUUID();
  const database = createPlatformDb({ connectionString: connectionString ?? "" });

  before(async () => {
    await database.db.insert(tenants).values({
      id: tenantId,
      handle: `billing-lifecycle-${tenantId.slice(0, 8)}`,
      name: "Billing Lifecycle Integration",
    });
    await database.db.insert(plans).values({ id: planId, name: "Paid", price: "1000" });
    await database.db.insert(planVersions).values({
      id: planVersionId,
      planId,
      version: 1,
      fingerprint: `billing-lifecycle-${planVersionId}`,
      name: "Paid",
      price: "1000",
    });
    await database.db.insert(subscriptions).values({
      id: subscriptionId,
      tenantId,
      planId,
      planVersionId,
      status: "active",
      manualPaymentState: "paid",
      currentPeriodEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
  });

  after(async () => {
    await database.db.delete(billingOutboxEvents).where(eq(billingOutboxEvents.tenantId, tenantId));
    await database.db.delete(invoices).where(eq(invoices.tenantId, tenantId));
    await database.db.delete(subscriptions).where(eq(subscriptions.tenantId, tenantId));
    await database.db.delete(planVersions).where(eq(planVersions.planId, planId));
    await database.db.delete(plans).where(eq(plans.id, planId));
    await database.db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.pool.end();
  });

  it("creates one renewal invoice and one outbox event under concurrent sweeps", async () => {
    const billing = createBillingService(database.db);
    await Promise.all(
      Array.from({ length: 10 }, () => billing.syncTenantBillingLifecycle({ tenantId })),
    );

    const renewalInvoices = await database.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, "pending")));
    const events = await database.db
      .select({ eventType: billingOutboxEvents.eventType })
      .from(billingOutboxEvents)
      .where(eq(billingOutboxEvents.tenantId, tenantId));
    assert.equal(renewalInvoices.length, 1);
    assert.deepEqual(events, [{ eventType: "billing.invoice_ready" }]);
  });

  it("keeps failed notification hand-off durable and retries it", async () => {
    let fail = true;
    let deliveries = 0;
    const outbox = createBillingOutbox(database.db, async () => {
      deliveries += 1;
      if (fail) throw new Error("notification service unavailable");
    });

    assert.equal((await outbox.processDue({ tenantId })).failed, 1);
    await database.db
      .update(billingOutboxEvents)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(billingOutboxEvents.tenantId, tenantId));
    fail = false;
    assert.equal((await outbox.processDue({ tenantId })).completed, 1);
    assert.equal(deliveries, 2);
  });
});
