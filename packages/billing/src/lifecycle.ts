import type { BillingInterval } from "./domain.js";

/** Issue renewal invoices this many days before period end. */
export const BILLING_RENEWAL_LEAD_DAYS = 7;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function addBillingInterval(from: Date, interval: BillingInterval, count = 1): Date {
  if (!Number.isSafeInteger(count) || count < 1 || Number.isNaN(from.getTime())) {
    throw new Error("A billing period requires a valid date and positive interval count.");
  }
  const next = new Date(from);
  if (interval === "day" || interval === "week") {
    next.setUTCDate(next.getUTCDate() + count * (interval === "week" ? 7 : 1));
    return next;
  }

  const monthOffset = count * (interval === "year" ? 12 : 1);
  const targetMonth = next.getUTCMonth() + monthOffset;
  const targetYear = next.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  next.setUTCFullYear(targetYear, normalizedMonth, Math.min(next.getUTCDate(), lastDay));
  return next;
}

/**
 * Encoded in subscriptions.manual_payment_state when a free-plan downgrade
 * is scheduled for period end (no refunds — keep paid access until then).
 */
export const SCHEDULED_DOWNGRADE_PREFIX = "scheduled_downgrade:";

export function encodeScheduledDowngrade(planId: string) {
  return `${SCHEDULED_DOWNGRADE_PREFIX}${planId}`;
}

export function parseScheduledDowngradePlanId(
  manualPaymentState: string | null | undefined,
): string | null {
  const value = manualPaymentState?.trim() ?? "";
  if (!value.startsWith(SCHEDULED_DOWNGRADE_PREFIX)) return null;
  const planId = value.slice(SCHEDULED_DOWNGRADE_PREFIX.length).trim();
  return planId || null;
}

export function planBillingLifecycle(input: {
  currentPeriodEnd: Date | null;
  manualPaymentState: string;
  now: Date;
  status: string;
}) {
  const scheduledPlanId = parseScheduledDowngradePlanId(input.manualPaymentState);
  const periodEnded =
    input.currentPeriodEnd != null && input.currentPeriodEnd.getTime() <= input.now.getTime();
  if (input.status === "trialing") {
    return {
      applyScheduledDowngrade: false,
      createRenewalInvoice: false,
      expireTrial: periodEnded,
      markPastDue: false,
      scheduledPlanId: null,
    };
  }
  if (scheduledPlanId) {
    return {
      createRenewalInvoice: false,
      expireTrial: false,
      markPastDue: false,
      scheduledPlanId,
      applyScheduledDowngrade: periodEnded,
    };
  }
  const renewalWindowStart = input.currentPeriodEnd
    ? input.currentPeriodEnd.getTime() - BILLING_RENEWAL_LEAD_DAYS * MS_PER_DAY
    : null;
  return {
    applyScheduledDowngrade: false,
    createRenewalInvoice: renewalWindowStart != null && input.now.getTime() >= renewalWindowStart,
    expireTrial: false,
    markPastDue: periodEnded && input.status === "active",
    scheduledPlanId: null,
  };
}
