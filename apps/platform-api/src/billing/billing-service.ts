import type { createPlatformDb } from "@ecs/db";
import { auditLogs, invoices, plans, subscriptions } from "@ecs/db";
import { and, desc, eq } from "drizzle-orm";

import type { BillingInvoice, BillingInvoiceUpdateResult, BillingStatusResult } from "../app.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];
const allowedInvoiceStatuses = new Set(["pending", "paid", "cancelled", "void"]);

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
        .select(selectInvoiceFields())
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
          await transaction
            .update(subscriptions)
            .set({
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
