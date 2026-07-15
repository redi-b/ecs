export type BillingInvoice = {
  id: string;
  amount: string;
  currency: string;
  status: string;
  dueAt: string | null;
  paidAt: string | null;
  provider: string | null;
  providerReference: string | null;
  createdAt: string;
};

export type BillingPlanSummary = {
  id: string;
  name: string;
  price: string;
  limits: unknown;
  features: unknown;
  isFree?: boolean;
};

export type BillingCatalogPlan = {
  id: string;
  name: string;
  price: string;
  isFree: boolean;
  isCurrent: boolean;
};

export type BillingStatus = {
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    manualPaymentState: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    /** Free plan id scheduled to take effect at period end (no refund). */
    scheduledPlanId?: string | null;
    scheduledPlanName?: string | null;
    scheduledEffectiveAt?: string | null;
  };
  plan: {
    id: string;
    name: string;
    price: string;
    limits: unknown;
    features: unknown;
    isFree: boolean;
  };
  invoices: BillingInvoice[];
  /** @deprecated Prefer `catalog`. Paid plans other than the current one. */
  availablePaidPlans: BillingPlanSummary[];
  /** Active plans for selection UI (order stable by price). */
  catalog: BillingCatalogPlan[];
};

export type BillingPlanDowngradeResult =
  | {
      ok: true;
      applied: boolean;
      scheduled: boolean;
      effectiveAt: string | null;
      billing: BillingStatus;
    }
  | {
      ok: false;
      error:
        | "billing_not_found"
        | "billing_plan_not_found"
        | "billing_plan_not_free"
        | "billing_already_on_plan"
        | "billing_not_on_paid_plan";
      status: 400 | 404;
    };

export type BillingCancelDowngradeResult =
  | {
      ok: true;
      cancelled: boolean;
      billing: BillingStatus;
    }
  | {
      ok: false;
      error: "billing_not_found" | "billing_no_scheduled_downgrade";
      status: 400 | 404;
    };

export type BillingStatusResult =
  | {
      ok: true;
      billing: BillingStatus;
    }
  | {
      ok: false;
      error: "billing_not_found";
    };

export type BillingInvoiceUpdateResult =
  | {
      ok: true;
      invoice: BillingInvoice;
    }
  | {
      ok: false;
      error: "billing_invoice_not_found" | "billing_invoice_status_invalid";
      status: 400 | 404;
    };

export type BillingPlanUpgradeResult =
  | {
      ok: true;
      invoice: BillingInvoice;
      reused: boolean;
    }
  | {
      ok: false;
      error:
        | "billing_not_found"
        | "billing_plan_not_found"
        | "billing_plan_is_free"
        | "billing_already_on_plan";
      status: 400 | 404;
    };

export type BillingInvoicePayResult =
  | {
      ok: true;
      checkoutUrl: string;
      txRef: string;
      invoice: BillingInvoice;
      /** Prior Chapa charge already succeeded; client should refresh, not open checkout. */
      alreadyPaid?: boolean;
    }
  | {
      ok: false;
      error:
        | "billing_invoice_not_found"
        | "billing_invoice_not_payable"
        | "billing_invoice_is_free"
        | "billing_chapa_unavailable"
        | "billing_chapa_init_failed"
        | "billing_payer_email_required";
      status: 400 | 404 | 502 | 503;
      message?: string;
    };
