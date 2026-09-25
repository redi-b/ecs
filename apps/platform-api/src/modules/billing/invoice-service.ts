import { addBillingInterval, type BillingInterval } from "@ecs/billing";
import type { createPlatformDb } from "@ecs/db";
import {
  auditLogs,
  billingOutboxEvents,
  billingPaymentEvidence,
  invoices,
  plans,
  planVersions,
  subscriptions,
  subscriptionTrials,
} from "@ecs/db";
import { and, desc, eq, sql } from "drizzle-orm";

import type { BillingInvoice, BillingInvoiceUpdateResult } from "../../types/index.js";
import { BILLING_RENEWAL_LEAD_DAYS, MS_PER_DAY, parseScheduledDowngradePlanId } from "@ecs/billing";
import { isAcceptedLinksEtReference } from "./links-et-payment-verifier.js";
import {
  type BillingPaymentVerificationInput,
  type BillingPaymentVerificationResult,
  manualBillingPaymentVerifier,
} from "./payment-verification.js";
import { DEFAULT_PLAN_IDS } from "./plan-catalog.js";

type PlatformDb = ReturnType<typeof createPlatformDb>["db"];

export type BillingServicePaymentOptions = {
  paymentDestinations?: Array<{
    accountName: string;
    accountNumber: string;
    label: string;
    provider: string;
  }>;
  verifyPaymentEvidence?: (
    input: BillingPaymentVerificationInput,
  ) => Promise<BillingPaymentVerificationResult>;
  onPaymentVerification?: (result: {
    decision: BillingPaymentVerificationResult["decision"];
    invoiceId: string;
    provider: string;
    source: string;
  }) => void;
};

type BillingInvoiceServiceOptions = {
  db: PlatformDb;
  options: BillingServicePaymentOptions | undefined;
  ensureFreeSubscription: (input: { tenantId: string }) => Promise<unknown>;
  ensurePendingPlanInvoice: (input: {
    tenantId: string;
    subscriptionId: string;
    planId: string;
    planVersionId: string | null;
    planPrice: string;
  }) => Promise<{ created: boolean; invoiceId: string | null }>;
  latestPlanVersion: (planId: string) => Promise<{ id: string } | null>;
};

const allowedOperatorInvoiceStatuses = new Set(["paid", "cancelled", "void", "evidence_rejected"]);

/** Platform-billing Chapa tx_ref prefix (commerce order refs must never use this). */
export const BILLING_CHAPA_TX_PREFIX = "ecs_bill_";

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

export function serializeDate(value: Date | null) {
  return value ? value.toISOString() : null;
}

export function serializeInvoice(invoice: {
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
    amount: String(invoice.amount),
    currency: invoice.currency,
    status: invoice.status,
    dueAt: serializeDate(invoice.dueAt),
    paidAt: serializeDate(invoice.paidAt),
    provider: invoice.provider?.trim() ? invoice.provider.trim() : null,
    providerReference: invoice.providerReference?.trim() ? invoice.providerReference.trim() : null,
    createdAt: invoice.createdAt.toISOString(),
  };
}

export function selectInvoiceFields() {
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

function normalizePaymentReference(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function serializePaymentEvidence(evidence: {
  createdAt: Date;
  id: string;
  provider: string;
  status: string;
  submittedReference: string;
  reviewReason?: string | null;
  verificationSource?: string | null;
}) {
  return {
    id: evidence.id,
    provider: evidence.provider,
    reference: evidence.submittedReference,
    status: evidence.status,
    reviewReason: evidence.reviewReason?.trim() || null,
    verificationSource: evidence.verificationSource?.trim() || null,
    createdAt: evidence.createdAt.toISOString(),
  };
}

function planPriceNumber(price: string) {
  const value = Number(price);
  return Number.isFinite(value) ? value : NaN;
}

export function isFreePlanPrice(price: string) {
  return planPriceNumber(price) === 0;
}

export function createBillingInvoiceService(input: BillingInvoiceServiceOptions) {
  const { db, options, ensureFreeSubscription, ensurePendingPlanInvoice, latestPlanVersion } =
    input;

  const settleInvoice = async (input: {
    invoiceId: string;
    provider: string;
    providerReference: string;
    tenantId: string;
  }): Promise<
    | { ok: true; applied: boolean; invoice: BillingInvoice }
    | { ok: false; error: "billing_invoice_not_found" | "billing_invoice_not_payable" }
  > => {
    const [current] = await db
      .select({
        ...selectInvoiceFields(),
        planVersionId: invoices.planVersionId,
        subscriptionId: invoices.subscriptionId,
      })
      .from(invoices)
      .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId)))
      .limit(1);

    if (!current) return { ok: false, error: "billing_invoice_not_found" };
    if (current.status === "paid") {
      return { ok: true, applied: false, invoice: serializeInvoice(current) };
    }
    if (current.status !== "pending") {
      return { ok: false, error: "billing_invoice_not_payable" };
    }

    const planIdFromInvoice = current.provider?.startsWith("plan:")
      ? current.provider.slice("plan:".length)
      : null;
    let settled: typeof current | null = null;

    await db.transaction(async (transaction) => {
      const [paid] = await transaction
        .update(invoices)
        .set({
          status: "paid",
          paidAt: new Date(),
          provider: input.provider.trim(),
          providerReference: input.providerReference.trim(),
        })
        .where(
          and(
            eq(invoices.id, input.invoiceId),
            eq(invoices.tenantId, input.tenantId),
            eq(invoices.status, "pending"),
          ),
        )
        .returning({
          ...selectInvoiceFields(),
          planVersionId: invoices.planVersionId,
          subscriptionId: invoices.subscriptionId,
        });
      if (!paid) return;
      settled = paid;
      if (!paid.subscriptionId) return;

      const [sub] = await transaction
        .select({
          renewalPlanVersionId: subscriptions.renewalPlanVersionId,
          renewalEffectiveAt: subscriptions.renewalEffectiveAt,
          currentPeriodEnd: subscriptions.currentPeriodEnd,
          planId: subscriptions.planId,
          planVersionId: subscriptions.planVersionId,
          status: subscriptions.status,
        })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.id, paid.subscriptionId),
            eq(subscriptions.tenantId, input.tenantId),
          ),
        )
        .limit(1);

      const now = new Date();
      const base =
        sub?.status !== "trialing" && sub?.currentPeriodEnd && sub.currentPeriodEnd > now
          ? sub.currentPeriodEnd
          : now;
      const requestedPlanId = planIdFromInvoice ?? sub?.planId ?? DEFAULT_PLAN_IDS.growth;
      const [nextPlanVersion] = paid.planVersionId
        ? await transaction
            .select({
              billingInterval: planVersions.billingInterval,
              id: planVersions.id,
              planId: planVersions.planId,
            })
            .from(planVersions)
            .where(eq(planVersions.id, paid.planVersionId))
            .limit(1)
        : await transaction
            .select({
              billingInterval: planVersions.billingInterval,
              id: planVersions.id,
              planId: planVersions.planId,
            })
            .from(planVersions)
            .where(eq(planVersions.planId, requestedPlanId))
            .orderBy(desc(planVersions.version))
            .limit(1);
      const nextPlanId = nextPlanVersion?.planId ?? requestedPlanId;
      const nextPlanVersionId = nextPlanVersion?.id ?? sub?.planVersionId;
      const interval = (nextPlanVersion?.billingInterval ?? "month") as BillingInterval;
      const nextEnd = addBillingInterval(base, interval);
      if (!nextPlanVersionId) throw new Error("billing_plan_version_not_found");
      const consumedRenewal = sub?.renewalPlanVersionId === nextPlanVersionId;

      await transaction
        .update(subscriptions)
        .set({
          planId: nextPlanId,
          planVersionId: nextPlanVersionId,
          renewalPlanVersionId: consumedRenewal ? null : sub?.renewalPlanVersionId,
          renewalEffectiveAt: consumedRenewal ? null : sub?.renewalPlanVersionId ? nextEnd : null,
          currentPeriodEnd: nextEnd,
          currentPeriodStart: now,
          manualPaymentState: "paid",
          status: "active",
          trialConvertedAt: sub?.status === "trialing" ? now : undefined,
          trialEndsAt: sub?.status === "trialing" ? null : undefined,
        })
        .where(
          and(
            eq(subscriptions.id, paid.subscriptionId),
            eq(subscriptions.tenantId, input.tenantId),
          ),
        );
      if (sub?.status === "trialing") {
        await transaction
          .update(subscriptionTrials)
          .set({ convertedAt: now, status: "converted" })
          .where(
            and(
              eq(subscriptionTrials.subscriptionId, paid.subscriptionId),
              eq(subscriptionTrials.status, "active"),
            ),
          );
      }
    });

    if (!settled) {
      const [latest] = await db
        .select(selectInvoiceFields())
        .from(invoices)
        .where(eq(invoices.id, input.invoiceId))
        .limit(1);
      if (latest?.status === "paid") {
        return { ok: true, applied: false, invoice: serializeInvoice(latest) };
      }
      return { ok: false, error: "billing_invoice_not_payable" };
    }
    return { ok: true, applied: true, invoice: serializeInvoice(settled) };
  };

  return {
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
      await ensureFreeSubscription(input);

      const [plan] = await db
        .select({
          id: plans.id,
          kind: plans.kind,
          name: plans.name,
          ownerTenantId: plans.tenantId,
          price: plans.price,
          status: plans.status,
          visibility: plans.visibility,
        })
        .from(plans)
        .where(and(eq(plans.id, input.planId), eq(plans.status, "active")))
        .limit(1);

      if (!plan) {
        return { ok: false, error: "billing_plan_not_found", status: 404 };
      }

      if (
        (plan.kind === "standard" && plan.visibility !== "public") ||
        (plan.kind === "custom" && plan.ownerTenantId !== input.tenantId)
      ) {
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
          manualPaymentState: subscriptions.manualPaymentState,
        })
        .from(subscriptions)
        .where(eq(subscriptions.tenantId, input.tenantId))
        .limit(1);

      if (!subscription) {
        return { ok: false, error: "billing_not_found", status: 404 };
      }

      // Paying / renewing cancels any free-switch schedule.
      if (parseScheduledDowngradePlanId(subscription.manualPaymentState)) {
        await db
          .update(subscriptions)
          .set({ manualPaymentState: "paid" })
          .where(eq(subscriptions.id, subscription.id));
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

      const ensured = await ensurePendingPlanInvoice({
        tenantId: input.tenantId,
        subscriptionId: subscription.id,
        planId: plan.id,
        planVersionId: (await latestPlanVersion(plan.id))?.id ?? null,
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
          planVersionId: invoices.planVersionId,
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
          tenantId: invoices.tenantId,
          providerReference: invoices.providerReference,
          status: invoices.status,
        })
        .from(invoices)
        .where(and(eq(invoices.tenantId, input.tenantId), eq(invoices.status, "pending")));

      return rows
        .filter((row) => row.providerReference && isPlatformBillingTxRef(row.providerReference))
        .map((row) => ({
          invoiceId: row.id,
          tenantId: row.tenantId,
          txRef: row.providerReference as string,
        }));
    },

    /**
     * Global sweep of pending ecs_bill_* invoices (worker reconcile job).
     * Newest first; limited so one run cannot hammer Chapa.
     */
    listAllPendingChapaInvoiceTxRefs: async (input?: { limit?: number }) => {
      const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
      const rows = await db
        .select({
          id: invoices.id,
          tenantId: invoices.tenantId,
          providerReference: invoices.providerReference,
        })
        .from(invoices)
        .where(eq(invoices.status, "pending"))
        .orderBy(desc(invoices.createdAt))
        .limit(limit);

      return rows
        .filter((row) => row.providerReference && isPlatformBillingTxRef(row.providerReference))
        .map((row) => ({
          invoiceId: row.id,
          tenantId: row.tenantId,
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
          planVersionId: invoices.planVersionId,
          subscriptionId: invoices.subscriptionId,
        })
        .from(invoices)
        .where(
          and(eq(invoices.tenantId, input.tenantId), eq(invoices.providerReference, input.txRef)),
        )
        .limit(1);

      if (!invoice) {
        return { ok: false, error: "billing_invoice_not_found" };
      }
      const result = await settleInvoice({
        invoiceId: invoice.id,
        provider: "chapa",
        providerReference: input.providerReference?.trim() || input.txRef,
        tenantId: input.tenantId,
      });
      return result.ok ? { ok: true, applied: result.applied } : { ok: false, error: result.error };
    },

    submitBillingPaymentEvidence: async (input: {
      invoiceId: string;
      provider: string;
      reference: string;
      tenantId: string;
    }) => {
      const provider = input.provider.trim().toLowerCase();
      const reference = input.reference.trim();
      if (
        !new Set(["telebirr", "cbe", "boa", "other"]).has(provider) ||
        reference.length < 6 ||
        reference.length > 500 ||
        ((provider === "telebirr" || provider === "cbe") &&
          !isAcceptedLinksEtReference(provider, reference))
      ) {
        return {
          ok: false as const,
          error: "billing_payment_evidence_invalid" as const,
          status: 400 as const,
        };
      }

      const [invoice] = await db
        .select({
          amount: invoices.amount,
          currency: invoices.currency,
          createdAt: invoices.createdAt,
          id: invoices.id,
          status: invoices.status,
        })
        .from(invoices)
        .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId)))
        .limit(1);
      if (!invoice) {
        return {
          ok: false as const,
          error: "billing_invoice_not_found" as const,
          status: 404 as const,
        };
      }
      if (invoice.status !== "pending") {
        return {
          ok: false as const,
          error: "billing_invoice_not_payable" as const,
          status: 400 as const,
        };
      }

      const verification = await (options?.verifyPaymentEvidence ?? manualBillingPaymentVerifier)({
        approvedRecipients: (options?.paymentDestinations ?? [])
          .filter((destination) => destination.provider === provider)
          .map((destination) => ({
            accountName: destination.accountName,
            accountNumber: destination.accountNumber,
          })),
        amount: String(invoice.amount),
        currency: invoice.currency,
        invoiceId: invoice.id,
        issuedAt: invoice.createdAt,
        provider,
        reference,
        tenantId: input.tenantId,
      });
      options?.onPaymentVerification?.({
        decision: verification.decision,
        invoiceId: invoice.id,
        provider,
        source: verification.source,
      });
      const normalizedReference = normalizePaymentReference(
        verification.providerReference ?? reference,
      );

      const evidence = await db.transaction(async (transaction) => {
        const [created] = await transaction
          .insert(billingPaymentEvidence)
          .values({
            invoiceId: invoice.id,
            tenantId: input.tenantId,
            provider,
            submittedReference: reference,
            normalizedReference,
            status: verification.decision,
            verificationSource: verification.source,
            verificationResult: verification.details ?? {},
          })
          .onConflictDoNothing({
            target: [billingPaymentEvidence.provider, billingPaymentEvidence.normalizedReference],
          })
          .returning({
            createdAt: billingPaymentEvidence.createdAt,
            id: billingPaymentEvidence.id,
            provider: billingPaymentEvidence.provider,
            reviewReason: billingPaymentEvidence.reviewReason,
            status: billingPaymentEvidence.status,
            submittedReference: billingPaymentEvidence.submittedReference,
            verificationSource: billingPaymentEvidence.verificationSource,
          });
        if (!created) return null;

        await transaction
          .update(billingPaymentEvidence)
          .set({ status: "superseded", updatedAt: new Date() })
          .where(
            and(
              eq(billingPaymentEvidence.invoiceId, invoice.id),
              sql`${billingPaymentEvidence.status} in ('submitted', 'verifying', 'needs_review')`,
              sql`${billingPaymentEvidence.id} <> ${created.id}`,
            ),
          );
        if (verification.decision === "rejected") {
          await transaction
            .insert(billingOutboxEvents)
            .values({
              tenantId: input.tenantId,
              eventKey: `billing.payment_rejected:${created.id}`,
              eventType: "billing.payment_rejected",
              payload: {
                amount: String(invoice.amount),
                currencyCode: invoice.currency,
                invoiceId: invoice.id,
                reason: "The receipt details did not match this invoice.",
                sourceEventId: `payment-evidence:${created.id}`,
              },
            })
            .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
        }
        return created;
      });

      if (!evidence) {
        return {
          ok: false as const,
          error: "billing_payment_reference_duplicate" as const,
          status: 409 as const,
        };
      }
      if (verification.decision === "verified") {
        const settlement = await settleInvoice({
          invoiceId: invoice.id,
          provider,
          providerReference: verification.providerReference ?? reference,
          tenantId: input.tenantId,
        });
        if (!settlement.ok) {
          return {
            ok: false as const,
            error: settlement.error,
            status:
              settlement.error === "billing_invoice_not_found" ? (404 as const) : (400 as const),
          };
        }
      }
      return { ok: true as const, evidence: serializePaymentEvidence(evidence) };
    },

    updateBillingInvoiceStatus: async (input: {
      invoiceId: string;
      operatorUserId: string;
      platformPrincipalId: string;
      provider?: string | null | undefined;
      providerReference?: string | null | undefined;
      reason: string;
      status: string;
      tenantId: string;
    }): Promise<BillingInvoiceUpdateResult> => {
      const status = input.status.trim().toLowerCase();

      if (
        !allowedOperatorInvoiceStatuses.has(status) ||
        input.reason.trim().length < 10 ||
        (status === "paid" && (!input.provider?.trim() || !input.providerReference?.trim()))
      ) {
        return {
          ok: false,
          error: "billing_invoice_status_invalid",
          status: 400,
        };
      }

      if (status === "evidence_rejected") {
        const now = new Date();
        const result = await db.transaction(async (transaction) => {
          const [evidence] = await transaction
            .update(billingPaymentEvidence)
            .set({
              status: "rejected",
              reviewedAt: now,
              reviewedByUserId: input.operatorUserId,
              reviewReason: input.reason.trim(),
              updatedAt: now,
            })
            .where(
              and(
                eq(billingPaymentEvidence.invoiceId, input.invoiceId),
                eq(billingPaymentEvidence.tenantId, input.tenantId),
                eq(billingPaymentEvidence.status, "needs_review"),
              ),
            )
            .returning({ id: billingPaymentEvidence.id });
          if (!evidence) return null;

          const [row] = await transaction
            .select(selectInvoiceFields())
            .from(invoices)
            .where(
              and(
                eq(invoices.id, input.invoiceId),
                eq(invoices.tenantId, input.tenantId),
                eq(invoices.status, "pending"),
              ),
            )
            .limit(1);
          if (!row) return null;

          await transaction
            .insert(billingOutboxEvents)
            .values({
              tenantId: input.tenantId,
              eventKey: `billing.payment_rejected:${evidence.id}`,
              eventType: "billing.payment_rejected",
              payload: {
                amount: String(row.amount),
                currencyCode: row.currency,
                invoiceId: row.id,
                reason: input.reason.trim(),
                sourceEventId: `payment-evidence:${evidence.id}`,
              },
            })
            .onConflictDoNothing({ target: billingOutboxEvents.eventKey });
          await transaction.insert(auditLogs).values({
            actorUserId: input.operatorUserId,
            platformPrincipalId: input.platformPrincipalId,
            tenantId: input.tenantId,
            action: "billing.payment_evidence_rejected",
            targetType: "billing_payment_evidence",
            targetId: evidence.id,
            metadata: { invoiceId: row.id, reason: input.reason.trim() },
          });
          return serializeInvoice(row);
        });

        if (!result) {
          return { ok: false, error: "billing_invoice_status_invalid", status: 400 };
        }
        return { ok: true, invoice: result };
      }

      const settlement =
        status === "paid"
          ? await settleInvoice({
              invoiceId: input.invoiceId,
              provider: input.provider?.trim() || "manual",
              providerReference: input.providerReference?.trim() || "",
              tenantId: input.tenantId,
            })
          : null;
      const invoice = settlement
        ? settlement.ok
          ? settlement.invoice
          : null
        : await db.transaction(async (transaction) => {
            const [row] = await transaction
              .update(invoices)
              .set({ paidAt: null, status })
              .where(
                and(
                  eq(invoices.id, input.invoiceId),
                  eq(invoices.tenantId, input.tenantId),
                  eq(invoices.status, "pending"),
                ),
              )
              .returning(selectInvoiceFields());
            return row ? serializeInvoice(row) : null;
          });

      if (!invoice) {
        const [existing] = await db
          .select({ id: invoices.id })
          .from(invoices)
          .where(and(eq(invoices.id, input.invoiceId), eq(invoices.tenantId, input.tenantId)))
          .limit(1);
        return {
          ok: false,
          error: existing ? "billing_invoice_status_invalid" : "billing_invoice_not_found",
          status: existing ? 400 : 404,
        };
      }

      await db.transaction(async (transaction) => {
        const evidenceStatus = status === "paid" ? "verified" : "rejected";
        await transaction
          .update(billingPaymentEvidence)
          .set({
            status: evidenceStatus,
            reviewedAt: new Date(),
            reviewedByUserId: input.operatorUserId,
            reviewReason: input.reason.trim(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(billingPaymentEvidence.invoiceId, input.invoiceId),
              sql`${billingPaymentEvidence.status} in ('needs_review', 'rejected')`,
            ),
          );
        await transaction.insert(auditLogs).values({
          actorUserId: input.operatorUserId,
          platformPrincipalId: input.platformPrincipalId,
          tenantId: input.tenantId,
          action: "billing.invoice_status_changed",
          targetType: "invoice",
          targetId: invoice.id,
          metadata: {
            provider: invoice.provider,
            reason: input.reason.trim(),
            status: invoice.status,
          },
        });
      });

      return {
        ok: true,
        invoice,
      };
    },
  };
}
