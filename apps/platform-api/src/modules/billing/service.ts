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

/** Platform-billing Chapa tx_ref prefix (commerce order refs must never use this). */
export const BILLING_CHAPA_TX_PREFIX = "ecs_bill_";

/** Issue renewal invoices this many days before period end. */
export const BILLING_RENEWAL_LEAD_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function isPlatformBillingTxRef(txRef: string) {
  return txRef.trim().toLowerCase().startsWith(BILLING_CHAPA_TX_PREFIX);
}

export function billingTxRefForInvoice(invoiceId: string) {
  // Unique every attempt — Chapa rejects reused tx_ref ("already been used").
  // Format: ecs_bill_{12 hex from invoice}_{8 random} (~29 chars, under Chapa limits).
  const compact = invoiceId.replaceAll("-", "").slice(0, 12);
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8);
  return `${BILLING_CHAPA_TX_PREFIX}${compact}_${suffix}`;
}

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

function planPriceNumber(price: string) {
  const value = Number(price);
  return Number.isFinite(value) ? value : NaN;
}

function isFreePlanPrice(price: string) {
  return planPriceNumber(price) === 0;
}

export function createBillingService(db: PlatformDb) {
  const self = () => createBillingService(db);

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
          features: { analytics: true, managedCheckout: true, freeForever: true },
        })
        .onConflictDoUpdate({
          target: plans.id,
          set: {
            features: { analytics: true, managedCheckout: true, freeForever: true },
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
     * Free forever Starter when a shop is provisioned (idempotent).
     * No trial expiry, no payment invoices.
     */
    ensureFreeSubscription: async (input: { tenantId: string }) => {
      await self().ensureDefaultPlans();

      const [existing] = await db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (existing) {
        // One-time soft migrate: only the free Starter plan. Paid-plan trials
        // (future Growth trialing) are left alone so we can still use trialing later.
        if (existing.planId === DEFAULT_PLAN_IDS.starter && existing.status === "trialing") {
          await db
            .update(subscriptions)
            .set({
              status: "active",
              currentPeriodEnd: null,
              manualPaymentState: "none",
            })
            .where(eq(subscriptions.id, existing.id));
        }
        return { created: false as const, subscriptionId: existing.id };
      }

      const now = new Date();
      const [subscription] = await db
        .insert(subscriptions)
        .values({
          tenantId: input.tenantId,
          planId: DEFAULT_PLAN_IDS.starter,
          status: "active",
          billingCycle: "monthly",
          currentPeriodStart: now,
          currentPeriodEnd: null,
          manualPaymentState: "none",
        })
        .returning({ id: subscriptions.id });

      return { created: true as const, subscriptionId: subscription?.id ?? null };
    },

    /** @deprecated Prefer ensureFreeSubscription — kept for call sites. */
    ensureTrialSubscription: async (input: { tenantId: string }) => {
      return self().ensureFreeSubscription(input);
    },

    listPlans: async () => {
      await self().ensureDefaultPlans();
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
          isFree: isFreePlanPrice(plan.price),
        })),
      };
    },

    /**
     * Per-tenant maintenance: renewal invoices near period end, past_due when expired.
     * Free plans are never touched. Safe to call on every billing read.
     */
    syncTenantBillingLifecycle: async (input: { tenantId: string }) => {
      const [row] = await db
        .select({
          subscriptionId: subscriptions.id,
          status: subscriptions.status,
          planId: plans.id,
          planPrice: plans.price,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId))
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (!row || isFreePlanPrice(row.planPrice)) {
        return { renewed: false, pastDue: false };
      }

      const now = new Date();
      let pastDue = false;
      let renewed = false;

      if (
        row.currentPeriodEnd &&
        row.currentPeriodEnd.getTime() <= now.getTime() &&
        (row.status === "active" || row.status === "trialing")
      ) {
        await db
          .update(subscriptions)
          .set({ status: "past_due" })
          .where(eq(subscriptions.id, row.subscriptionId));
        pastDue = true;
      }

      const periodEnd = row.currentPeriodEnd;
      if (periodEnd) {
        const leadEnd = new Date(periodEnd.getTime() - BILLING_RENEWAL_LEAD_DAYS * MS_PER_DAY);
        const inWindow = now.getTime() >= leadEnd.getTime();
        if (inWindow) {
          const invoiceResult = await self().ensurePendingPlanInvoice({
            tenantId: input.tenantId,
            subscriptionId: row.subscriptionId,
            planId: row.planId,
            planPrice: row.planPrice,
          });
          renewed = invoiceResult.created;
        }
      }

      return { renewed, pastDue };
    },

    /**
     * Ensure a pending invoice exists for a paid plan (upgrade or renewal).
     */
    ensurePendingPlanInvoice: async (input: {
      tenantId: string;
      subscriptionId: string;
      planId: string;
      planPrice: string;
    }): Promise<{ created: boolean; invoiceId: string | null }> => {
      if (isFreePlanPrice(input.planPrice)) {
        return { created: false, invoiceId: null };
      }

      const [existing] = await db
        .select(selectInvoiceFields())
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, input.tenantId),
            eq(invoices.status, "pending"),
            eq(invoices.amount, input.planPrice),
            eq(invoices.currency, "ETB"),
          ),
        )
        .orderBy(desc(invoices.createdAt))
        .limit(1);

      if (existing) {
        if (!existing.provider?.startsWith("plan:")) {
          await db
            .update(invoices)
            .set({ provider: `plan:${input.planId}` })
            .where(eq(invoices.id, existing.id));
        }
        return { created: false, invoiceId: existing.id };
      }

      const now = new Date();
      const dueAt = new Date(now);
      dueAt.setUTCDate(dueAt.getUTCDate() + BILLING_RENEWAL_LEAD_DAYS);

      const [created] = await db
        .insert(invoices)
        .values({
          tenantId: input.tenantId,
          subscriptionId: input.subscriptionId,
          amount: input.planPrice,
          currency: "ETB",
          status: "pending",
          dueAt,
          paidAt: null,
          provider: `plan:${input.planId}`,
          providerReference: null,
        })
        .returning({ id: invoices.id });

      return { created: Boolean(created), invoiceId: created?.id ?? null };
    },

    /**
     * Sweep all paid subscriptions (worker entrypoint).
     */
    runBillingLifecycle: async () => {
      const rows = await db
        .select({
          tenantId: subscriptions.tenantId,
          planPrice: plans.price,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(plans.id, subscriptions.planId));

      let scanned = 0;
      let renewed = 0;
      let pastDue = 0;

      for (const row of rows) {
        if (isFreePlanPrice(row.planPrice)) continue;
        scanned += 1;
        const result = await self().syncTenantBillingLifecycle({ tenantId: row.tenantId });
        if (result.renewed) renewed += 1;
        if (result.pastDue) pastDue += 1;
      }

      return { scanned, renewed, pastDue };
    },

    getBillingStatus: async (input: { tenantId: string }): Promise<BillingStatusResult> => {
      await self().ensureFreeSubscription(input);
      await self().syncTenantBillingLifecycle(input);

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

      const planList = await self().listPlans();
      const catalog = planList.plans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        price: plan.price,
        isFree: plan.isFree,
        isCurrent: plan.id === subscription.planId,
      }));
      const availablePaidPlans = planList.plans.filter(
        (plan) => !plan.isFree && plan.id !== subscription.planId,
      );

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
            isFree: isFreePlanPrice(subscription.planPrice),
          },
          invoices: invoiceRows.map((invoice) => serializeInvoice(invoice)),
          availablePaidPlans: availablePaidPlans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            price: plan.price,
            limits: plan.limits,
            features: plan.features,
          })),
          catalog,
        },
      };
    },

    /**
     * Self-serve: create (or reuse) a pending invoice to move onto a paid plan.
     * Free plans never get payment invoices. Plan switches only after Chapa pay.
     */
    createPlanUpgradeInvoice: async (input: {
      planId: string;
      tenantId: string;
    }): Promise<
      | { ok: true; invoice: BillingInvoice; reused: boolean }
      | {
          ok: false;
          error:
            | "billing_not_found"
            | "billing_plan_not_found"
            | "billing_plan_is_free"
            | "billing_already_on_plan";
          status: 400 | 404;
        }
    > => {
      await self().ensureFreeSubscription(input);

      const [plan] = await db
        .select({
          id: plans.id,
          name: plans.name,
          price: plans.price,
          status: plans.status,
        })
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.status, "active")))
        .limit(1);

      if (!plan) {
        return { ok: false, error: "billing_plan_not_found", status: 404 };
      }

      if (isFreePlanPrice(plan.price)) {
        return { ok: false, error: "billing_plan_is_free", status: 400 };
      }

      const [subscription] = await db
        .select({
          id: subscriptions.id,
          planId: subscriptions.planId,
          status: subscriptions.status,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (!subscription) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      const now = new Date();
      // Allow renewal invoices inside the lead window or after period end.
      const renewalCutoff = now.getTime() + BILLING_RENEWAL_LEAD_DAYS * MS_PER_DAY;
      const stillCovered =
        subscription.planId === plan.id &&
        subscription.status === "active" &&
        subscription.currentPeriodEnd != null &&
        subscription.currentPeriodEnd.getTime() > renewalCutoff;

      if (stillCovered) {
        return { ok: false, error: "billing_already_on_plan", status: 400 };
      }

      const ensured = await self().ensurePendingPlanInvoice({
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        planId: plan.id,
        planPrice: plan.price,
      });

      if (!ensured.invoiceId) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      const [row] = await db
        .select(selectInvoiceFields())
        .from(invoices)
        .where(eq(invoices.id, ensured.invoiceId))
        .limit(1);

      if (!row) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      return {
        ok: true,
        invoice: serializeInvoice(row),
        reused: !ensured.created,
      };
    },

    /**
     * Bind a fresh Chapa tx_ref on a pending paid invoice (new ref every attempt).
     * Caller should first try verifying any prior tx_ref via confirm/complete.
     */
    prepareInvoiceForChapaPayment: async (input: {
      invoiceId: string;
      tenantId: string;
    }): Promise<
      | {
          ok: true;
          invoice: BillingInvoice;
          amount: string;
          currency: string;
          txRef: string;
          planId: string | null;
          previousTxRef: string | null;
        }
      | {
          ok: false;
          error:
            | "billing_invoice_not_found"
            | "billing_invoice_not_payable"
            | "billing_invoice_is_free";
          status: 400 | 404;
        }
    > => {
      const [invoice] = await db
        .select({
          ...selectInvoiceFields(),
          subscriptionId: invoices.subscriptionId,
        })
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId)))
        .limit(1);

      if (!invoice) {
        return { ok: false, error: "billing_invoice_not_found", status: 404 };
      }

      if (invoice.status !== "pending") {
        return { ok: false, error: "billing_invoice_not_payable", status: 400 };
      }

      if (isFreePlanPrice(invoice.amount)) {
        return { ok: false, error: "billing_invoice_is_free", status: 400 };
      }

      const previousTxRef =
        invoice.providerReference && isPlatformBillingTxRef(invoice.providerReference)
          ? invoice.providerReference
          : null;

      // Always mint a new tx_ref so retries work after a prior Chapa initialize.
      const txRef = billingTxRefForInvoice(invoice.id);
      const planIdFromProvider = invoice.provider?.startsWith("plan:")
        ? invoice.provider.slice("plan:".length)
        : null;

      await db
        .update(invoices)
        .set({
          // Keep plan:{id} so completeChapaInvoicePayment knows the target plan.
          provider: planIdFromProvider ? `plan:${planIdFromProvider}` : invoice.provider,
          providerReference: txRef,
        })
        .where(eq(invoices.id, invoice.id));

      const [updated] = await db
        .select(selectInvoiceFields())
        .from(invoices)
        .where(eq(invoices.id, invoice.id))
        .limit(1);

      return {
        ok: true,
        invoice: serializeInvoice(updated ?? invoice),
        amount: invoice.amount,
        currency: invoice.currency,
        txRef,
        planId: planIdFromProvider,
        previousTxRef,
      };
    },

    /**
     * Find pending platform-billing invoices for a tenant (with Chapa tx refs).
     * Used to re-verify after return_url when webhook/callback did not run (local dev).
     */
    listPendingChapaInvoiceTxRefs: async (input: { tenantId: string }) => {
      const rows = await db
        .select({
          id: invoices.id,
          providerReference: invoices.providerReference,
          status: invoices.status,
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.status, "pending")));

      return rows
        .filter(
          (row) =>
            row.providerReference &&
            isPlatformBillingTxRef(row.providerReference),
        )
        .map((row) => ({
          invoiceId: row.id,
          txRef: row.providerReference as string,
        }));
    },

    /**
     * After Chapa verifies success for an ecs_bill_ tx_ref: mark invoice paid and activate plan period.
     */
    completeChapaInvoicePayment: async (input: {
      providerReference?: string | null;
      tenantId: string;
      txRef: string;
    }): Promise<{ ok: true; applied: boolean } | { ok: false; error: string }> => {
      if (!isPlatformBillingTxRef(input.txRef)) {
        return { ok: false, error: "not_platform_billing_tx" };
      }

      const [invoice] = await db
        .select({
          ...selectInvoiceFields(),
          subscriptionId: invoices.subscriptionId,
        })
        .from(invoices)
        .where(
          and(
            eq(invoices.tenantId, input.tenantId),
            eq(invoices.providerReference, input.txRef),
          ),
        )
        .limit(1);

      if (!invoice) {
        return { ok: false, error: "billing_invoice_not_found" };
      }

      if (invoice.status === "paid") {
        return { ok: true, applied: false };
      }

      if (invoice.status !== "pending") {
        return { ok: false, error: "billing_invoice_not_payable" };
      }

      const planIdFromProvider =
        invoice.provider?.startsWith("plan:") ? invoice.provider.slice("plan:".length) : null;

      await db.transaction(async (transaction) => {
        await transaction
          .update(invoices)
          .set({
            status: "paid",
            paidAt: new Date(),
            provider: "chapa",
            providerReference: input.providerReference?.trim() || input.txRef,
          })
          .where(eq(invoices.id, invoice.id));

        if (!invoice.subscriptionId) {
          return;
        }

        const [sub] = await transaction
          .select({
            billingCycle: subscriptions.billingCycle,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            planId: subscriptions.planId,
          })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.id, invoice.subscriptionId),
              eq(subscriptions.tenantId, input.tenantId),
            ),
          )
          .limit(1);

        const now = new Date();
        const base =
          sub?.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
        const months = sub?.billingCycle === "yearly" ? 12 : 1;
        const nextEnd = addBillingMonths(base, months);
        const nextPlanId = planIdFromProvider ?? sub?.planId ?? DEFAULT_PLAN_IDS.growth;

        await transaction
          .update(subscriptions)
          .set({
            planId: nextPlanId,
            currentPeriodEnd: nextEnd,
            currentPeriodStart: now,
            manualPaymentState: "paid",
            status: "active",
          })
          .where(
            and(
              eq(subscriptions.id, invoice.subscriptionId),
              eq(subscriptions.tenantId, input.tenantId),
            ),
          );
      });

      return { ok: true, applied: true };
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
