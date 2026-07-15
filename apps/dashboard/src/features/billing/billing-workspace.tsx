"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { dashboardRoutes } from "@/lib/routes";

type CatalogPlan = {
  id: string;
  name: string;
  price: string;
  isFree: boolean;
  isCurrent: boolean;
};

type InvoiceRow = NonNullable<
  NonNullable<MerchantDashboardSummary["billing"]>["invoices"]
>[number];

/**
 * Merchant-facing plan copy. Not raw DB limits (those are not enforced yet).
 * Unknown future plans fall back to name + price only.
 */
const PLAN_COPY: Record<
  string,
  {
    tagline: string;
    highlights: string[];
  }
> = {
  Starter: {
    tagline: "Everything you need to run your shop online.",
    highlights: [
      "Storefront, catalog, and media",
      "Orders and customers",
      "No subscription payment",
    ],
  },
  Growth: {
    tagline: "Prepaid plan for shops ready to invest in scale.",
    highlights: [
      "Everything in Starter",
      "Monthly prepaid access",
      "Pay securely with Chapa",
    ],
  },
};

function planCopy(name: string) {
  return (
    PLAN_COPY[name] ?? {
      tagline: "Plan details for your shop.",
      highlights: [] as string[],
    }
  );
}

export function BillingWorkspace({
  summary,
  returnedFromPayment = false,
  billingPath,
}: {
  summary: MerchantDashboardSummary;
  /** Landed from Chapa return_url with paid=1. */
  returnedFromPayment?: boolean;
  billingPath?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const busy = isPending;
  const billing = summary.billing;

  const catalog = useMemo((): CatalogPlan[] => {
    if (!billing?.plan) return [];
    if (billing.catalog && billing.catalog.length > 0) {
      return billing.catalog;
    }
    const current: CatalogPlan = {
      id: billing.plan.id,
      name: billing.plan.name,
      price: billing.plan.price,
      isFree: billing.plan.isFree === true || Number(billing.plan.price) === 0,
      isCurrent: true,
    };
    const others = (billing.availablePaidPlans ?? []).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      isFree: Number(plan.price) === 0,
      isCurrent: false,
    }));
    return [current, ...others];
  }, [billing]);

  const currentPlan = catalog.find((plan) => plan.isCurrent) ?? catalog[0];
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const resolvedSelectedId =
    selectedPlanId && catalog.some((plan) => plan.id === selectedPlanId)
      ? selectedPlanId
      : (currentPlan?.id ?? null);
  const selectedPlan =
    catalog.find((plan) => plan.id === resolvedSelectedId) ?? currentPlan ?? null;

  const invoices = useMemo(() => {
    return (billing?.invoices ?? []).filter((invoice) => {
      if (invoice.provider === "trial") return false;
      const amount = Number(invoice.amount);
      if (Number.isFinite(amount) && amount === 0 && invoice.status === "paid") return false;
      return true;
    });
  }, [billing?.invoices]);

  if (billing?.unavailable || !billing?.plan || !billing.subscription || !currentPlan || !selectedPlan) {
    return (
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyTitle>Billing is not available</EmptyTitle>
          <EmptyDescription>
            We could not load plan information for this shop. Open billing from the account menu,
            or refresh this page.
          </EmptyDescription>
        </EmptyHeader>
        {billingPath ? (
          <Button asChild className="mt-4" variant="outline">
            <Link href={billingPath} prefetch={false}>
              Reload billing
            </Link>
          </Button>
        ) : null}
      </Empty>
    );
  }

  const activePlan = currentPlan;
  const chosenPlan = selectedPlan;
  const subscription = billing.subscription;

  const openInvoice = invoices.find((invoice) => invoice.status === "pending") ?? null;
  const history = invoices.filter((invoice) => invoice.id !== openInvoice?.id);

  const isCurrentFree = activePlan.isFree;
  const selectedIsCurrent = chosenPlan.id === activePlan.id;
  const selectedIsFree = chosenPlan.isFree;
  const periodEndMs = subscription.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).getTime()
    : null;
  const daysToPeriodEnd =
    periodEndMs != null && Number.isFinite(periodEndMs)
      ? (periodEndMs - Date.now()) / (24 * 60 * 60 * 1000)
      : null;
  const inRenewalWindow =
    !isCurrentFree &&
    daysToPeriodEnd != null &&
    daysToPeriodEnd <= 7;

  function returnToBillingUrl() {
    // Build with URLSearchParams only — never HTML-entity-encode (&amp;), which
    // Chapa/return redirects may otherwise preserve and break query parsing.
    const url = new URL(dashboardRoutes.billing, window.location.origin);
    url.searchParams.set("tenantId", summary.tenant.id);
    url.searchParams.set("paid", "1");
    return url.href;
  }

  function runBillingAction(body: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const path = getTenantScopedPath("/admin/billing/actions", summary.tenant.id);
        const response = await fetch(path, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          toast.error(toastErrorFromBody(data));
          return;
        }

        if (data?.alreadyPaid === true) {
          toast.success("Payment confirmed.");
          router.refresh();
          return;
        }

        if (typeof data?.checkoutUrl === "string" && data.checkoutUrl) {
          toast.success("Opening secure checkout…");
          window.location.href = data.checkoutUrl;
          return;
        }

        toast.success("Invoice ready.");
        router.refresh();
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  function handlePrimaryAction() {
    // Pay only when a paid plan is selected (not while browsing free/current free).
    if (openInvoice && !selectedIsFree) {
      runBillingAction({
        action: "pay",
        invoiceId: openInvoice.id,
        returnUrl: returnToBillingUrl(),
      });
      return;
    }

    if (selectedIsCurrent && selectedIsFree) {
      return;
    }

    // Renew current paid plan (lead window or past due).
    if (selectedIsCurrent && !selectedIsFree && (inRenewalWindow || subscription.status === "past_due")) {
      runBillingAction({
        action: "upgrade",
        planId: chosenPlan.id,
      });
      return;
    }

    if (selectedIsCurrent && !selectedIsFree) {
      return;
    }

    if (!selectedIsFree) {
      runBillingAction({
        action: "upgrade",
        planId: chosenPlan.id,
      });
    }
  }

  const primaryLabel = (() => {
    // Pay belongs on paid selection; free selection never shows Pay (open invoice is above).
    if (openInvoice && !selectedIsFree) {
      return `Pay ${formatMoney(openInvoice.amount, openInvoice.currency)}`;
    }
    if (selectedIsCurrent && selectedIsFree) {
      return "Current plan";
    }
    if (
      selectedIsCurrent &&
      !selectedIsFree &&
      (inRenewalWindow || subscription.status === "past_due")
    ) {
      return subscription.status === "past_due" ? "Renew plan" : "Renew period";
    }
    if (selectedIsCurrent && !selectedIsFree) {
      return "Current plan";
    }
    if (!selectedIsFree) {
      return `Continue with ${chosenPlan.name}`;
    }
    return "Select a plan";
  })();

  const primaryDisabled =
    busy ||
    (selectedIsFree && !selectedIsCurrent) ||
    (selectedIsCurrent && selectedIsFree) ||
    (selectedIsCurrent &&
      !selectedIsFree &&
      !openInvoice &&
      !inRenewalWindow &&
      subscription.status !== "past_due");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      {/* Current plan — single source of truth, one status */}
      <section className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Current plan
        </p>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">{activePlan.name}</h2>
          <Badge variant="secondary">{isCurrentFree ? "Free" : formatStatus(subscription.status)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {isCurrentFree
            ? "No payment is required for this shop."
            : subscription.currentPeriodEnd
              ? `Paid through ${formatDate(subscription.currentPeriodEnd)} · ${formatPlanPrice(activePlan.price)} / ${formatCycle(subscription.billingCycle)}`
              : `${formatPlanPrice(activePlan.price)} · ${formatCycle(subscription.billingCycle)}`}
        </p>
      </section>

      {returnedFromPayment && openInvoice ? (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Checking your payment</CardTitle>
            <CardDescription>
              If you finished checkout, confirmation can take a moment. Use Pay again only if the
              charge did not complete.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {returnedFromPayment && !openInvoice && !isCurrentFree ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment received</CardTitle>
            <CardDescription>
              Your paid plan is active
              {subscription.currentPeriodEnd
                ? ` through ${formatDate(subscription.currentPeriodEnd)}`
                : ""}
              .
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {/* Open payment — only when something is actually unpaid */}
      {openInvoice ? (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment required</CardTitle>
            <CardDescription>Pay to activate or extend your plan.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{invoiceTitle(openInvoice)}</p>
              <p className="text-sm text-muted-foreground">
                {formatMoney(openInvoice.amount, openInvoice.currency)}
                {openInvoice.dueAt ? ` · Due ${formatDate(openInvoice.dueAt)}` : ""}
              </p>
            </div>
            <Button
              disabled={busy}
              type="button"
              onClick={() =>
                runBillingAction({
                  action: "pay",
                  invoiceId: openInvoice.id,
                  returnUrl: returnToBillingUrl(),
                })
              }
            >
              Pay with Chapa
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Plan selection — scales with catalog length */}
      <section className="flex flex-col gap-3">
        <div>
          <h3 className="text-base font-semibold">Plans</h3>
          <p className="text-sm text-muted-foreground">
            Choose a plan for this shop. You only pay when you select a paid plan.
          </p>
        </div>

        <div
          className={cn(
            "grid gap-3",
            catalog.length === 1 && "grid-cols-1",
            catalog.length === 2 && "sm:grid-cols-2",
            catalog.length >= 3 && "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {catalog.map((plan) => {
            const copy = planCopy(plan.name);
            const selected = plan.id === chosenPlan.id;
            return (
              <button
                key={plan.id}
                type="button"
                disabled={busy}
                onClick={() => setSelectedPlanId(plan.id as string)}
                className={cn(
                  "flex flex-col rounded-2xl border bg-card p-4 text-left transition-colors",
                  "hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selected ? "border-primary ring-1 ring-primary/30" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{plan.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{copy.tagline}</p>
                  </div>
                  {plan.isCurrent ? (
                    <Badge variant="secondary">Current</Badge>
                  ) : null}
                </div>
                <p className="mt-3 text-lg font-semibold tabular-nums">
                  {formatPlanPrice(plan.price)}
                  {!plan.isFree ? (
                    <span className="text-sm font-normal text-muted-foreground"> / month</span>
                  ) : null}
                </p>
                {copy.highlights.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {copy.highlights.map((line) => (
                      <li
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                        key={line}
                      >
                        <AppIcons.check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedIsCurrent
              ? selectedIsFree
                ? openInvoice
                  ? "You are on Starter. Select Growth to continue payment for the upgrade."
                  : "You are already on this plan."
                : openInvoice
                  ? "Finish payment to activate or extend this plan."
                  : inRenewalWindow
                    ? "Your current period is ending soon. Renew to stay on this plan."
                    : subscription.status === "past_due"
                      ? "Your paid period has ended. Renew to continue on this plan."
                      : "You are already on this plan."
              : selectedIsFree
                ? "Downgrading to a free plan is not available from this page."
                : openInvoice
                  ? "Complete payment for the open invoice, or continue to confirm this plan."
                  : `You will be charged ${formatPlanPrice(chosenPlan.price)} for one month after payment.`}
          </p>
          <Button
            className="shrink-0 sm:min-w-[12rem]"
            disabled={primaryDisabled || (selectedIsFree && !selectedIsCurrent)}
            type="button"
            onClick={handlePrimaryAction}
          >
            {primaryLabel}
          </Button>
        </div>
      </section>

      {/* History — quiet, only when relevant */}
      {history.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold">Payment history</h3>
            <p className="text-sm text-muted-foreground">Past charges for this shop.</p>
          </div>
          <ul className="flex flex-col gap-2">
            {history.map((invoice) => (
              <li
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-sm"
                key={invoice.id}
              >
                <div className="min-w-0">
                  <p className="font-medium">{invoiceTitle(invoice)}</p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.paidAt
                      ? `Paid ${formatDate(invoice.paidAt)}`
                      : `Created ${formatDate(invoice.createdAt)}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono tabular-nums">
                    {formatMoney(invoice.amount, invoice.currency)}
                  </span>
                  <Badge variant="secondary">{invoiceStatusLabel(invoice.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-center text-xs text-muted-foreground">
        <Link
          className="underline-offset-2 hover:underline"
          href={dashboardRoutes.settings}
          prefetch={false}
        >
          Shop settings
        </Link>
        {" · "}
        <a
          className="underline-offset-2 hover:underline"
          href={`//${summary.domain.hostname}`}
          rel="noreferrer"
          target="_blank"
        >
          View storefront
        </a>
      </p>
    </div>
  );
}

function formatCycle(cycle: string) {
  if (cycle === "monthly") return "month";
  if (cycle === "yearly" || cycle === "annual") return "year";
  return cycle;
}

function formatStatus(status: string) {
  if (status === "trialing") return "Trial";
  if (status === "active") return "Active";
  if (status === "past_due") return "Past due";
  if (status === "canceled" || status === "cancelled") return "Cancelled";
  return status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}

function formatPlanPrice(price: string) {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return price;
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-ET", {
    currency: "ETB",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function formatMoney(amount: string, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency.toUpperCase()}`;
  try {
    return new Intl.NumberFormat("en-ET", {
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
      style: "currency",
    }).format(value);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
}

function invoiceTitle(invoice: InvoiceRow) {
  if (invoice.provider === "chapa" || invoice.status === "paid") return "Plan payment";
  if (invoice.provider?.startsWith("plan:")) return "Plan upgrade";
  if (invoice.status === "pending") return "Open invoice";
  return "Invoice";
}

function invoiceStatusLabel(status: string) {
  if (status === "pending") return "Unpaid";
  if (status === "paid") return "Paid";
  if (status === "void" || status === "cancelled") return "Cancelled";
  return status;
}

/** Prefer explicit API message; never toast raw objects as [object Object]. */
function toastErrorFromBody(data: unknown): string {
  const record =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : {};
  const message = typeof record.message === "string" ? record.message.trim() : "";
  const error = typeof record.error === "string" ? record.error.trim() : "";
  if (message && message !== "[object Object]") {
    return message;
  }
  if (error && error !== "[object Object]") {
    return mapPlatformErrorMessage(error);
  }
  return mapPlatformErrorMessage("billing_pay_failed");
}
