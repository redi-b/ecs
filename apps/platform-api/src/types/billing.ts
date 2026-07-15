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

export type BillingStatus = {
  subscription: {
    id: string;
    status: string;
    billingCycle: string;
    manualPaymentState: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
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
  /** Paid plans the merchant can upgrade to (excludes current free/paid plan). */
  availablePaidPlans: BillingPlanSummary[];
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
