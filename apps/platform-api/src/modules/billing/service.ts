import type { createPlatformDb } from "@ecs/db";
import { auditLogs, invoices, plans, subscriptions } from "@ecs/db";
import { and, desc, eq } from "drizzle-orm";

import type {
  BillingInvoice,
  BillingInvoiceUpdateResult,
  BillingStatusResult,
} from "../../types/index.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const allowedInvoiceStatuses = new Set(["pending", "paid", "cancelled", "void"]);

/** Stable UUIDs so ensureDefaultPlans is idempotent across runs. */
export const DEFAULT_PLAN_IDS = {
  starter: "a1000000-0000-4000-8000-000000000001",
  growth: "a1000000-0000-4000-8000-000000000002",
} as const;

function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

function serializeInvoice(invoice: {
  amount: string;
  createdAt: Date;
  currency: string;
  dueAt: Date | null;
  id: string;
  paidAt: Date | null;
  provider: string | null;
  providerReference: string | null;
  status: string;
}): BillingInvoice {
  return {
    id: invoice.id,
    amount: invoice.amount,
    currency: invoice.currency,
    status: invoice.status,
    dueAt: serializeDate(invoice.dueAt),
    paidAt: serializeDate(invoice.paidAt),
    provider: invoice.provider,
    providerReference: invoice.providerReference,
    createdAt: invoice.createdAt.toISOString(),
  };
}

function selectInvoiceFields() {
  return {
    id: invoices.id,
    amount: invoices.amount,
    currency: invoices.currency,
    status: invoices.status,
    dueAt: invoices.dueAt,
    paidAt: invoices.paidAt,
    provider: invoices.provider,
    providerReference: invoices.providerReference,
    createdAt: invoices.createdAt,
  };
}

function addBillingMonths(from: Date, months: number) {
  const next = new Date(from);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

export function createBillingService(db: PlatformDb) {
  return {
    ensureDefaultPlans: async () => {
      await db
        .insert(plans)
        .values({
          id: DEFAULT_PLAN_IDS.starter,
          name: "Starter",
          price: "0",
          status: "active",
          limits: { products: 100, staff: 2, storefrontEvents: 10_000 },
          features: { analytics: true, managedCheckout: true, trial: true },
        })
        .onConflictDoUpdate({
          target: plans.id,
          set: {
            features: { analytics: true, managedCheckout: true, trial: true },
            limits: { products: 100, staff: 2, storefrontEvents: 10_000 },
            name: "Starter",
            price: "0",
            status: "active",
          },
        });

      await db
        .insert(plans)
        .values({
          id: DEFAULT_PLAN_IDS.growth,
          name: "Growth",
          price: "2499",
          status: "active",
          limits: { products: 2500, staff: 8, storefrontEvents: 100_000 },
          features: { analytics: true, managedCheckout: true, localDelivery: true },
        })
        .onConflictDoUpdate({
          target: plans.id,
          set: {
            features: { analytics: true, managedCheckout: true, localDelivery: true },
            limits: { products: 2500, staff: 8, storefrontEvents: 100_000 },
            name: "Growth",
            price: "2499",
            status: "active",
          },
        });
    },

    /**
     * Assign a 14-day Starter trial when a shop is provisioned (idempotent).
     */
    ensureTrialSubscription: async (input: { tenantId: string }) => {
      await createBillingService(db).ensureDefaultPlans();

      const [existing] = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (existing) {
        return { created: false as const, subscriptionId: existing.id };
      }

      const now = new Date();
      const trialEnd = addBillingMonths(now, 0);
      trialEnd.setUTCDate(trialEnd.getUTCDate() + 14);

      const [subscription] = await db
        .insert(subscriptions)
        .values({
          tenantId: input.tenantId,
          planId: DEFAULT_PLAN_IDS.starter,
          status: "trialing",
          billingCycle: "monthly",
          currentPeriodStart: now,
          currentPeriodEnd: trialEnd,
          manualPaymentState: "pending",
        })
        .returning({ id: subscriptions.id });

      return { created: true as const, subscriptionId: subscription?.id ?? null };
    },

    listPlans: async () => {
      await createBillingService(db).ensureDefaultPlans();
      const rows = await db
        .select({
          id: plans.id,
          name: plans.name,
          price: plans.price,
          limits: plans.limits,
          features: plans.features,
          status: plans.status,
        })
        .from(plans)
        .where(eq(plans.status, "active"))
        .orderBy(plans.price);

      return {
        ok: true as const,
        plans: rows.map((plan) => ({
          id: plan.id,
          name: plan.name,
          price: plan.price,
          limits: plan.limits,
          features: plan.features,
          status: plan.status,
        })),
      };
    },

    getBillingStatus: async (input: { tenantId: string }): Promise<BillingStatusResult> => {
      // Auto-attach trial for shops provisioned before this feature.
      await createBillingService(db).ensureTrialSubscription(input);

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
        .select(selectInvoiceFields())
        .from(invoices)
        .where(eq(invoices.tenantId, input.tenantId))
        .orderBy(desc(invoices.createdAt))
        .limit(20);

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
          invoices: invoiceRows.map((invoice) => serializeInvoice(invoice)),
        },
      };
    },

    updateBillingInvoiceStatus: async (input: {
      invoiceId: string;
      operatorUserId: string;
      provider?: string | null | undefined;
      providerReference?: string | null | undefined;
      status: string;
      tenantId: string;
    }): Promise<BillingInvoiceUpdateResult> => {
      const status = input.status.trim().toLowerCase();

      if (!allowedInvoiceStatuses.has(status)) {
        return {
          ok: false,
          error: "billing_invoice_status_invalid",
          status: 400,
        };
      }

      const invoice = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .update(invoices)
          .set({
            paidAt: status === "paid" ? new Date() : null,
            provider: input.provider ?? null,
            providerReference: input.providerReference ?? null,
            status,
          })
          .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId)))
          .returning({
            ...selectInvoiceFields(),
            subscriptionId: invoices.subscriptionId,
          });

        if (!row) {
          return null;
        }

        if (status === "paid" && row.subscriptionId) {
          const [sub] = await transaction
            .select({
              billingCycle: subscriptions.billingCycle,
              currentPeriodEnd: subscriptions.currentPeriodEnd,
            })
            .from(subscriptions)
            .where(
              and(
                eq(subscriptions.id, row.subscriptionId),
                eq(subscriptions.tenantId, input.tenantId),
              ),
            )
            .limit(1);

          const now = new Date();
          const base =
            sub?.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
          const months = sub?.billingCycle === "yearly" ? 12 : 1;
          const nextEnd = addBillingMonths(base, months);

          await transaction
            .update(subscriptions)
            .set({
              currentPeriodEnd: nextEnd,
              currentPeriodStart: now,
              manualPaymentState: "paid",
              status: "active",
            })
            .where(
              and(
                eq(subscriptions.id, row.subscriptionId),
                eq(subscriptions.tenantId, input.tenantId),
              ),
            );
        }

        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          tenantId: input.tenantId,
          action: "billing.invoice_status_changed",
          targetType: "invoice",
          targetId: row.id,
          metadata: {
            provider: row.provider,
            status: row.status,
          },
        });

        return row;
      });

      if (!invoice) {
        return {
          ok: false,
          error: "billing_invoice_not_found",
          status: 404,
        };
      }

      return {
        ok: true,
        invoice: serializeInvoice(invoice),
      };
    },
  };
}
