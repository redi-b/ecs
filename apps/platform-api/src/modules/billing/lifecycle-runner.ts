import type { createPlatformDb } from "@ecs/db";
import { billingOutboxEvents, invoices, plans, planVersions, subscriptions } from "@ecs/db";
import { and, eq, lte, sql } from "drizzle-orm";

import { isFreePlanPrice } from "./invoice-service.js";
import { MS_PER_DAY } from "./lifecycle.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type BillingLifecycleRunnerOptions = {
  db: PlatformDb;
  syncTenantBillingLifecycle: (input: { tenantId: string }) => Promise<{
    pastDue: boolean;
    renewed: boolean;
  }>;
};

export function createBillingLifecycleRunner({
  db,
  syncTenantBillingLifecycle,
}: BillingLifecycleRunnerOptions) {
  return async function runBillingLifecycle() {
    const rows = await db
      .select({
        tenantId: subscriptions.tenantId,
        planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId));

    let scanned = 0;
    let renewed = 0;
    let pastDue = 0;
    for (const row of rows) {
      if (isFreePlanPrice(row.planPrice)) continue;
      scanned += 1;
      const result = await syncTenantBillingLifecycle({ tenantId: row.tenantId });
      if (result.renewed) renewed += 1;
      if (result.pastDue) pastDue += 1;
    }

    const now = new Date();
    const reminderCutoff = new Date(now.getTime() + 3 * MS_PER_DAY);
    const reminderInvoices = await db
      .select({
        amount: invoices.amount,
        currency: invoices.currency,
        dueAt: invoices.dueAt,
        invoiceId: invoices.id,
        planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
        subscriptionId: subscriptions.id,
        tenantId: invoices.tenantId,
      })
      .from(invoices)
      .innerJoin(subscriptions, eq(subscriptions.id, invoices.subscriptionId))
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .leftJoin(planVersions, eq(planVersions.id, invoices.planVersionId))
      .where(
        and(
          eq(invoices.status, "pending"),
          sql`${invoices.dueAt} is not null`,
          lte(invoices.dueAt, reminderCutoff),
          sql`${invoices.dueAt} > ${now}`,
        ),
      );

    let reminders = 0;
    for (const invoice of reminderInvoices) {
      if (!invoice.dueAt) continue;
      const daysRemaining = Math.ceil((invoice.dueAt.getTime() - now.getTime()) / MS_PER_DAY);
      if (daysRemaining !== 3 && daysRemaining !== 1) continue;
      const [created] = await db
        .insert(billingOutboxEvents)
        .values({
          eventKey: `billing.payment_reminder:${invoice.invoiceId}:${daysRemaining}`,
          eventType: "billing.invoice_ready",
          tenantId: invoice.tenantId,
          payload: {
            amount: String(invoice.amount),
            currencyCode: invoice.currency,
            daysRemaining,
            dueAt: invoice.dueAt.toISOString(),
            invoiceId: invoice.invoiceId,
            planName: invoice.planName,
            subscriptionId: invoice.subscriptionId,
          },
        })
        .onConflictDoNothing({ target: billingOutboxEvents.eventKey })
        .returning({ id: billingOutboxEvents.id });
      if (created) reminders += 1;
    }

    const endingTrials = await db
      .select({
        endsAt: subscriptions.trialEndsAt,
        planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
        subscriptionId: subscriptions.id,
        tenantId: subscriptions.tenantId,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(plans.id, subscriptions.planId))
      .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
      .where(
        and(
          eq(subscriptions.status, "trialing"),
          sql`${subscriptions.trialEndsAt} is not null`,
          sql`${subscriptions.trialEndsAt} > ${now}`,
          lte(subscriptions.trialEndsAt, reminderCutoff),
        ),
      );
    let trialReminders = 0;
    for (const trial of endingTrials) {
      if (!trial.endsAt) continue;
      const daysRemaining = Math.ceil((trial.endsAt.getTime() - now.getTime()) / MS_PER_DAY);
      if (daysRemaining !== 3 && daysRemaining !== 1) continue;
      const [created] = await db
        .insert(billingOutboxEvents)
        .values({
          eventKey: `billing.trial_ending:${trial.subscriptionId}:${daysRemaining}`,
          eventType: "billing.trial_ending",
          tenantId: trial.tenantId,
          payload: {
            daysRemaining,
            endsAt: trial.endsAt.toISOString(),
            planName: trial.planName,
            subscriptionId: trial.subscriptionId,
          },
        })
        .onConflictDoNothing({ target: billingOutboxEvents.eventKey })
        .returning({ id: billingOutboxEvents.id });
      if (created) trialReminders += 1;
    }

    return { scanned, renewed, pastDue, reminders, trialReminders };
  };
}
