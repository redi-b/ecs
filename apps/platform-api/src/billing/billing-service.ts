import type { createPlatformDb } from "@ecs/db";
import { invoices, plans, subscriptions } from "@ecs/db";
import { desc, eq } from "drizzle-orm";

import type { BillingStatusResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function createBillingService(db: PlatformDb) {
  return {
    getBillingStatus: async (input: { tenantId: string }): Promise<BillingStatusResult> => {
      const [subscription] = await db
        .select({
          subscriptionId: subscriptions.id,
          status: subscriptions.status,
          billingCycle: subscriptions.billingCycle,
          currentPeriodStart: subscriptions.currentPeriodStart,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          manualPaymentState: subscriptions.manualPaymentState,
          planId: plans.id,
          planName: plans.name,
          planPrice: plans.price,
          planLimits: plans.limits,
          planFeatures: plans.features,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .where(eq(subscriptions.tenantId, input.tenantId))
        .orderBy(desc(subscriptions.currentPeriodEnd))
        .limit(1);

      if (!subscription) {
        return {
          ok: false,
          error: "billing_not_found",
        };
      }

      const invoiceRows = await db
        .select({
          id: invoices.id,
          amount: invoices.amount,
          currency: invoices.currency,
          status: invoices.status,
          dueAt: invoices.dueAt,
          paidAt: invoices.paidAt,
          provider: invoices.provider,
          providerReference: invoices.providerReference,
          createdAt: invoices.createdAt,
        })
        .from(invoices)
        .where(eq(invoices.tenantId, input.tenantId))
        .orderBy(desc(invoices.createdAt))
        .limit(10);

      return {
        ok: true,
        billing: {
          subscription: {
            id: subscription.subscriptionId,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            manualPaymentState: subscription.manualPaymentState,
            currentPeriodStart: serializeDate(subscription.currentPeriodStart),
            currentPeriodEnd: serializeDate(subscription.currentPeriodEnd),
          },
          plan: {
            id: subscription.planId,
            name: subscription.planName,
            price: subscription.planPrice,
            limits: subscription.planLimits,
            features: subscription.planFeatures,
          },
          invoices: invoiceRows.map((invoice) => ({
            id: invoice.id,
            amount: invoice.amount,
            currency: invoice.currency,
            status: invoice.status,
            dueAt: serializeDate(invoice.dueAt),
            paidAt: serializeDate(invoice.paidAt),
            provider: invoice.provider,
            providerReference: invoice.providerReference,
            createdAt: invoice.createdAt.toISOString(),
          })),
        },
      };
    },
  };
}
