/** Issue renewal invoices this many days before period end. */
export const BILLING_RENEWAL_LEAD_DAYS = 7;

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
