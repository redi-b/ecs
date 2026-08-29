import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import { billingProviderEvents, createPlatformDb, tenants } from "@ecs/db";
import { eq } from "drizzle-orm";

import { createBillingProviderEventInbox } from "./provider-event-inbox.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

describe("billing provider-event inbox with PostgreSQL", { skip: !connectionString }, () => {
  const tenantId = randomUUID();
  const database = createPlatformDb({ connectionString: connectionString ?? "" });

  before(async () => {
    await database.db.insert(tenants).values({
      id: tenantId,
      handle: `billing-inbox-${tenantId.slice(0, 8)}`,
      name: "Billing Inbox Integration",
    });
  });

  after(async () => {
    await database.db
      .delete(billingProviderEvents)
      .where(eq(billingProviderEvents.tenantId, tenantId));
    await database.db.delete(tenants).where(eq(tenants.id, tenantId));
    await database.pool.end();
  });

  it("deduplicates concurrent delivery and applies a verified payment once", async () => {
    let completions = 0;
    const inbox = createBillingProviderEventInbox(database.db, async () => {
      completions += 1;
      return { ok: true, applied: true };
    });
    const payment = {
      providerReference: "chapa-ref-concurrent",
      tenantId,
      txRef: `ecs_bill_concurrent_${randomUUID()}`,
    };

    await Promise.all([
      inbox.recordAndProcessVerifiedPayment(payment),
      inbox.recordAndProcessVerifiedPayment(payment),
    ]);

    assert.equal(completions, 1);
    const events = await database.db
      .select({ status: billingProviderEvents.status })
      .from(billingProviderEvents)
      .where(eq(billingProviderEvents.eventKey, `payment-success:${payment.txRef}`));
    assert.deepEqual(events, [{ status: "completed" }]);
  });

  it("persists failures and retries them when they become due", async () => {
    let shouldFail = true;
    const inbox = createBillingProviderEventInbox(database.db, async () => {
      if (shouldFail) throw new Error("temporary failure");
      return { ok: true, applied: true };
    });
    const payment = {
      providerReference: "chapa-ref-retry",
      tenantId,
      txRef: `ecs_bill_retry_${randomUUID()}`,
    };

    assert.equal((await inbox.recordAndProcessVerifiedPayment(payment)).kind, "failed");
    await database.db
      .update(billingProviderEvents)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(billingProviderEvents.eventKey, `payment-success:${payment.txRef}`));
    shouldFail = false;

    assert.deepEqual(await inbox.processDue(), { scanned: 1, completed: 1, failed: 0 });
    const [event] = await database.db
      .select({ attempts: billingProviderEvents.attempts, status: billingProviderEvents.status })
      .from(billingProviderEvents)
      .where(eq(billingProviderEvents.eventKey, `payment-success:${payment.txRef}`));
    assert.deepEqual(event, { attempts: 2, status: "completed" });
  });
});
