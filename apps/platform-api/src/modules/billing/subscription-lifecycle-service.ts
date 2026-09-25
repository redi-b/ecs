import {
  addBillingInterval,
  BILLING_RENEWAL_LEAD_DAYS,
  type BillingInterval,
  planBillingLifecycle,
} from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import {
  billingOutboxEvents,
  invoices,
  plans,
  planVersions,
  subscriptions,
  subscriptionTrials,
} from "@ecs/db";
import { and, eq, sql } from "drizzle-orm";

import { isFreePlanPrice } from "./invoice-service.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

type ApplyScheduledDowngrade = (input: {
  tenantId: string;
  subscriptionId: string;
  planId: string;
}) => Promise<boolean>;

export function createBillingSubscriptionLifecycleService(input: {
  applyScheduledDowngrade: ApplyScheduledDowngrade;
  db: PlatformDb;
}) {
  const { applyScheduledDowngrade, db } = input;

  return {
    syncTenantBillingLifecycle: async (input: { tenantId: string }) => {
      const result = await db.transaction(async (transaction) => {
        await transaction.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`billing-lifecycle:${input.tenantId}`}, 0))`,
        );

        const [row] = await transaction
          .select({
            subscriptionId: subscriptions.id,
            planVersionId: subscriptions.planVersionId,
            status: subscriptions.status,
            planId: plans.id,
            planBillingInterval: sql<string>`coalesce(, 'month')`,
            planName: sql<string>`coalesce(${planVersions.name}, ${plans.name})`,
            planPrice: sql<string>`coalesce(${planVersions.price}, ${plans.price})`,
            currentPeriodEnd: subscriptions.currentPeriodEnd,
            renewalPlanVersionId: subscriptions.renewalPlanVersionId,
            renewalEffectiveAt: subscriptions.renewalEffectiveAt,
            trialEndsAt: subscriptions.trialEndsAt,
            trialFallbackPlanVersionId: subscriptions.trialFallbackPlanVersionId,
            manualPaymentState: subscriptions.manualPaymentState,
          })
          .from(subscriptions)
          .innerJoin(plans, eq(plans.id, subscriptions.planId))
          .leftJoin(planVersions, eq(planVersions.id, subscriptions.planVersionId))
          .where(eq(subscriptions.tenantId, input.tenantId))
          .limit(1);

        if (!row) {
          return {
            trialExpired: false,
            renewed: false,
            pastDue: false,
            scheduled: null as null | { planId: string; subscriptionId: string },
          };
        }

        if (isFreePlanPrice(row.planPrice) && row.status !== "trialing") {
          const now = new Date();
          if (!row.currentPeriodEnd || row.currentPeriodEnd > now) {
            return { trialExpired: false, renewed: false, pastDue: false, scheduled: null };
          }

          if (row.renewalPlanVersionId) {
            const [renewal] = await transaction
              .select({
                billingInterval: planVersions.billingInterval,
                id: planVersions.id,
                planId: planVersions.planId,
                name: planVersions.name,
                price: planVersions.price,
              })
              .from(planVersions)
              .where(eq(planVersions.id, row.renewalPlanVersionId))
              .limit(1);
            if (renewal && isFreePlanPrice(renewal.price)) {
              await transaction
                .update(subscriptions)
                .set({
                  planId: renewal.planId,
                  planVersionId: renewal.id,
                  renewalPlanVersionId: null,
                  renewalEffectiveAt: null,
                  currentPeriodStart: now,
                  currentPeriodEnd: addBillingInterval(
                    now,
                    renewal.billingInterval as BillingInterval,
                  ),
                })
                .where(eq(subscriptions.id, row.subscriptionId));
              return { trialExpired: false, renewed: true, pastDue: false, scheduled: null };
            }
            if (renewal) {
              const [existingInvoice] = await transaction
                .select({ id: invoices.id })
                .from(invoices)
                .where(
                  and(
                    eq(invoices.subscriptionId, row.subscriptionId),
                    eq(invoices.status, "pending"),
                  ),
                )
                .limit(1);
              if (!existingInvoice) {
                const [created] = await transaction
                  .insert(invoices)
                  .values({
                    tenantId: input.tenantId,
                    subscriptionId: row.subscriptionId,
                    planVersionId: renewal.id,
                    amount: renewal.price,
                    currency: "ETB",
                    status: "pending",
                    dueAt: now,
                    provider: `plan:${renewal.planId}`,
                  })
                  .returning({ id: invoices.id });
                if (created) {
                  await transaction
                    .insert(billingOutboxEvents)
                    .values({
                      eventKey: `billing.invoice_ready:${created.id}`,
                      eventType: "billing.invoice_ready",
                      tenantId: input.tenantId,
                      payload: {
                        amount: String(renewal.price),
                        currencyCode: "ETB",
                        invoiceId: created.id,
                        planName: renewal.name,
                        subscriptionId: row.subscriptionId,
                      },
                    })
                    .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
                  return { trialExpired: false, renewed: true, pastDue: false, scheduled: null };
                }
              }
            }
          } else {
            await transaction
              .update(subscriptions)
              .set({
                currentPeriodStart: now,
                currentPeriodEnd: addBillingInterval(
                  now,
                  row.planBillingInterval as BillingInterval,
                ),
              })
              .where(eq(subscriptions.id, row.subscriptionId));
          }
          return { trialExpired: false, renewed: false, pastDue: false, scheduled: null };
        }

        const lifecycle = planBillingLifecycle({
          currentPeriodEnd: row.status === "trialing" ? row.trialEndsAt : row.currentPeriodEnd,
          manualPaymentState: row.manualPaymentState,
          now: new Date(),
          status: row.status,
        });
        if (lifecycle.expireTrial) {
          if (!row.trialFallbackPlanVersionId) {
            throw new Error(`Trial subscription ${row.subscriptionId} has no fallback version.`);
          }
          const [fallback] = await transaction
            .select({
              billingInterval: planVersions.billingInterval,
              id: planVersions.id,
              planId: planVersions.planId,
              price: planVersions.price,
            })
            .from(planVersions)
            .where(eq(planVersions.id, row.trialFallbackPlanVersionId))
            .limit(1);
          if (!fallback) throw new Error("Trial fallback plan version no longer exists.");
          const endedAt = new Date();
          await transaction
            .update(subscriptions)
            .set({
              currentPeriodEnd: isFreePlanPrice(fallback.price)
                ? addBillingInterval(endedAt, fallback.billingInterval as BillingInterval)
                : endedAt,
              currentPeriodStart: endedAt,
              manualPaymentState: isFreePlanPrice(fallback.price) ? "none" : "pending",
              planId: fallback.planId,
              planVersionId: fallback.id,
              status: "active",
              trialEndsAt: null,
            })
            .where(
              and(eq(subscriptions.id, row.subscriptionId), eq(subscriptions.status, "trialing")),
            );
          await transaction
            .update(subscriptionTrials)
            .set({ endedAt, status: "expired" })
            .where(
              and(
                eq(subscriptionTrials.subscriptionId, row.subscriptionId),
                eq(subscriptionTrials.status, "active"),
              ),
            );
          await transaction
            .insert(billingOutboxEvents)
            .values({
              eventKey: `billing.trial_expired:${row.subscriptionId}`,
              eventType: "billing.trial_expired",
              tenantId: input.tenantId,
              payload: {
                fallbackPlanVersionId: fallback.id,
                planName: row.planName,
                subscriptionId: row.subscriptionId,
              },
            })
            .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
          return { renewed: false, pastDue: false, scheduled: null, trialExpired: true };
        }
        if (lifecycle.scheduledPlanId) {
          return {
            renewed: false,
            pastDue: false,
            trialExpired: false,
            scheduled: lifecycle.applyScheduledDowngrade
              ? { planId: lifecycle.scheduledPlanId, subscriptionId: row.subscriptionId }
              : null,
          };
        }

        const [pendingInvoice] = await transaction
          .select({
            amount: invoices.amount,
            id: invoices.id,
            planVersionId: invoices.planVersionId,
          })
          .from(invoices)
          .where(
            and(
              eq(invoices.tenantId, input.tenantId),
              eq(invoices.status, "pending"),
              eq(invoices.subscriptionId, row.subscriptionId),
            ),
          )
          .limit(1);
        const pendingPlanVersionId = pendingInvoice?.planVersionId ?? null;
        const [pendingPlanVersion] = pendingPlanVersionId
          ? await transaction
              .select({
                id: planVersions.id,
                planId: planVersions.planId,
                name: planVersions.name,
                price: planVersions.price,
              })
              .from(planVersions)
              .where(eq(planVersions.id, pendingPlanVersionId))
              .limit(1)
          : [undefined];
        const renewalPlanVersionId = row.renewalPlanVersionId;
        const renewalAppliesToNextPeriod =
          renewalPlanVersionId &&
          (!row.renewalEffectiveAt ||
            !row.currentPeriodEnd ||
            row.renewalEffectiveAt <= row.currentPeriodEnd);
        const [renewalTerms] =
          !pendingPlanVersion && renewalAppliesToNextPeriod
            ? await transaction
                .select({
                  id: planVersions.id,
                  planId: planVersions.planId,
                  name: planVersions.name,
                  price: planVersions.price,
                })
                .from(planVersions)
                .where(eq(planVersions.id, renewalPlanVersionId))
                .limit(1)
            : [undefined];
        const invoicePlanVersionId =
          pendingPlanVersion?.id ?? renewalTerms?.id ?? row.planVersionId;
        const invoicePlanId = pendingPlanVersion?.planId ?? renewalTerms?.planId ?? row.planId;
        const invoicePlanName = pendingPlanVersion?.name ?? renewalTerms?.name ?? row.planName;
        const invoicePlanPrice = pendingInvoice?.amount ?? renewalTerms?.price ?? row.planPrice;
        const payload = {
          subscriptionId: row.subscriptionId,
          planName: invoicePlanName,
          amount: String(invoicePlanPrice),
          currencyCode: "ETB",
        };
        let pastDue = false;
        let renewed = false;

        if (lifecycle.markPastDue) {
          const [changed] = await transaction
            .update(subscriptions)
            .set({ status: "past_due" })
            .where(
              and(eq(subscriptions.id, row.subscriptionId), eq(subscriptions.status, row.status)),
            )
            .returning({ id: subscriptions.id });
          if (changed) {
            pastDue = true;
            const period = row.currentPeriodEnd?.toISOString() ?? "unknown-period";
            await transaction
              .insert(billingOutboxEvents)
              .values({
                eventKey: `billing.past_due:${row.subscriptionId}:${period}`,
                eventType: "billing.past_due",
                tenantId: input.tenantId,
                payload,
              })
              .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
          }
        }

        if (lifecycle.createRenewalInvoice) {
          if (!pendingInvoice) {
            const dueAt = new Date();
            dueAt.setUTCDate(dueAt.getUTCDate() + BILLING_RENEWAL_LEAD_DAYS);
            const [created] = await transaction
              .insert(invoices)
              .values({
                tenantId: input.tenantId,
                subscriptionId: row.subscriptionId,
                planVersionId: invoicePlanVersionId,
                amount: invoicePlanPrice,
                currency: "ETB",
                status: "pending",
                dueAt,
                provider: `plan:${invoicePlanId}`,
              })
              .returning({ id: invoices.id });
            if (created) {
              renewed = true;
              await transaction
                .insert(billingOutboxEvents)
                .values({
                  eventKey: `billing.invoice_ready:${created.id}`,
                  eventType: "billing.invoice_ready",
                  tenantId: input.tenantId,
                  payload: { ...payload, invoiceId: created.id },
                })
                .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
            }
          }
        }

        return {
          renewed,
          pastDue,
          scheduled: null as null | { planId: string; subscriptionId: string },
          trialExpired: false,
        };
      });

      if (result.scheduled) {
        const applied = await applyScheduledDowngrade({
          tenantId: input.tenantId,
          subscriptionId: result.scheduled.subscriptionId,
          planId: result.scheduled.planId,
        });
        return { renewed: false, pastDue: false, downgraded: applied, trialExpired: false };
      }
      return {
        renewed: result.renewed,
        pastDue: result.pastDue,
        downgraded: false,
        trialExpired: result.trialExpired,
      };
    },
  };
}
