import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

import {
  billingOutboxEvents,
  createPlatformDb,
  invoices,
  organizations,
  plans,
  planVersions,
  subscriptions,
  subscriptionTrials,
  tenants,
} from "@ecs/db";
import { and, eq } from "drizzle-orm";

import { createBillingOutbox } from "./outbox.js";
import { createBillingService } from "./service.js";

const connectionString = process.env.PLATFORM_AUTH_INTEGRATION_DATABASE_URL;

describe("billing lifecycle with PostgreSQL", { skip: !connectionString }, () => {
  const tenantId = randomUUID();
  const organizationId = `org_${tenantId.replaceAll("-", "")}`;
  const planId = randomUUID();
  const planVersionId = randomUUID();
  const subscriptionId = randomUUID();
  const database = createPlatformDb({ connectionString: connectionString ?? "" });

  before(async () => {
    await database.db.insert(organizations).values({
      id: organizationId,
      name: "Billing Lifecycle Integration",
      slug: `billing-lifecycle-${tenantId.slice(0, 8)}`,
    });
    await database.db.insert(tenants).values({
      id: tenantId,
      handle: `billing-lifecycle-${tenantId.slice(0, 8)}`,
      name: "Billing Lifecycle Integration",
      organizationId,
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
    await database.db.delete(organizations).where(eq(organizations.id, organizationId));
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

  it("settles a verified payment once and advances the subscription period", async () => {
    const billing = createBillingService(database.db);
    const invoiceId = randomUUID();
    const txRef = `ecs_bill_${invoiceId.replaceAll("-", "").slice(0, 12)}_verified`;
    const [before] = await database.db
      .select({ currentPeriodEnd: subscriptions.currentPeriodEnd })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);
    await database.db.insert(invoices).values({
      id: invoiceId,
      amount: "1000",
      currency: "ETB",
      planVersionId,
      provider: `plan:${planId}`,
      providerReference: txRef,
      status: "pending",
      subscriptionId,
      tenantId,
    });

    assert.deepEqual(await billing.completeChapaInvoicePayment({ tenantId, txRef }), {
      ok: true,
      applied: true,
    });
    assert.deepEqual(await billing.completeChapaInvoicePayment({ tenantId, txRef }), {
      ok: true,
      applied: false,
    });

    const [settled] = await database.db
      .select({ provider: invoices.provider, status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, invoiceId))
      .limit(1);
    const [after] = await database.db
      .select({ currentPeriodEnd: subscriptions.currentPeriodEnd })
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);
    assert.deepEqual(settled, { provider: "chapa", status: "paid" });
    assert.ok(before?.currentPeriodEnd);
    assert.ok(after?.currentPeriodEnd);
    assert.ok(after.currentPeriodEnd.getTime() > before.currentPeriodEnd.getTime());
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

  it("claims a trial once, pins its fallback, and returns there at expiry", async () => {
    const trialTenantId = randomUUID();
    const trialOrganizationId = `org_${trialTenantId.replaceAll("-", "")}`;
    const freePlanId = randomUUID();
    const freeVersionId = randomUUID();
    const trialPlanId = randomUUID();
    const trialVersionId = randomUUID();
    const trialSubscriptionId = randomUUID();
    const billing = createBillingService(database.db);

    try {
      await database.db.insert(organizations).values({
        id: trialOrganizationId,
        name: "Trial Lifecycle Integration",
        slug: `trial-lifecycle-${trialTenantId.slice(0, 8)}`,
      });
      await database.db.insert(tenants).values({
        id: trialTenantId,
        handle: `trial-lifecycle-${trialTenantId.slice(0, 8)}`,
        name: "Trial Lifecycle Integration",
        organizationId: trialOrganizationId,
      });
      await database.db.insert(plans).values({
        id: freePlanId,
        name: "Trial fallback",
        price: "0",
      });
      await database.db.insert(planVersions).values({
        id: freeVersionId,
        planId: freePlanId,
        version: 1,
        fingerprint: `trial-fallback-${freeVersionId}`,
        name: "Trial fallback",
        price: "0",
      });
      await database.db.insert(plans).values({
        id: trialPlanId,
        name: "Trial offer",
        price: "1000",
        visibility: "public",
      });
      await database.db.insert(planVersions).values({
        id: trialVersionId,
        planId: trialPlanId,
        version: 1,
        fingerprint: `trial-offer-${trialVersionId}`,
        name: "Trial offer",
        price: "1000",
        trialPolicy: {
          activation: "manual",
          durationDays: 14,
          eligibilityScope: "tenant",
          enabled: true,
          fallbackPlanVersionId: freeVersionId,
          paymentMethodRequired: false,
        },
      });
      await database.db.insert(subscriptions).values({
        id: trialSubscriptionId,
        tenantId: trialTenantId,
        planId: freePlanId,
        planVersionId: freeVersionId,
        status: "active",
        manualPaymentState: "none",
      });

      const attempts = await Promise.all(
        Array.from({ length: 8 }, () =>
          billing.startPlanTrial({
            actorUserId: "trial-test-user",
            planVersionId: trialVersionId,
            tenantId: trialTenantId,
          }),
        ),
      );
      assert.equal(attempts.filter((attempt) => attempt.ok).length, 1);

      const [activeTrial] = await database.db
        .select({
          fallbackPlanVersionId: subscriptions.trialFallbackPlanVersionId,
          planVersionId: subscriptions.planVersionId,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .where(eq(subscriptions.id, trialSubscriptionId));
      assert.deepEqual(activeTrial, {
        fallbackPlanVersionId: freeVersionId,
        planVersionId: trialVersionId,
        status: "trialing",
      });

      const expiredAt = new Date(Date.now() - 1_000);
      await database.db
        .update(subscriptions)
        .set({ trialEndsAt: expiredAt })
        .where(eq(subscriptions.id, trialSubscriptionId));

      const lifecycle = await billing.syncTenantBillingLifecycle({ tenantId: trialTenantId });
      assert.equal(lifecycle.trialExpired, true);

      const [afterExpiry] = await database.db
        .select({ planVersionId: subscriptions.planVersionId, status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, trialSubscriptionId));
      assert.deepEqual(afterExpiry, { planVersionId: freeVersionId, status: "active" });

      const reused = await billing.startPlanTrial({
        actorUserId: "trial-test-user",
        planVersionId: trialVersionId,
        tenantId: trialTenantId,
      });
      assert.deepEqual(reused, {
        error: "billing_trial_already_used",
        ok: false,
        status: 409,
      });
    } finally {
      await database.db
        .delete(billingOutboxEvents)
        .where(eq(billingOutboxEvents.tenantId, trialTenantId));
      await database.db
        .delete(subscriptionTrials)
        .where(eq(subscriptionTrials.tenantId, trialTenantId));
      await database.db.delete(subscriptions).where(eq(subscriptions.tenantId, trialTenantId));
      await database.db.delete(planVersions).where(eq(planVersions.planId, trialPlanId));
      await database.db.delete(planVersions).where(eq(planVersions.planId, freePlanId));
      await database.db.delete(plans).where(eq(plans.id, trialPlanId));
      await database.db.delete(plans).where(eq(plans.id, freePlanId));
      await database.db.delete(tenants).where(eq(tenants.id, trialTenantId));
      await database.db.delete(organizations).where(eq(organizations.id, trialOrganizationId));
    }
  });
});
