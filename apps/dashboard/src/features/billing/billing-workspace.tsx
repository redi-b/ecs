"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";
import Link from "@/components/app/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getTenantScopedPath } from "@/lib/dashboard-tenant-context";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";
import { dashboardRoutes } from "@/lib/routes";

/** Limits we do not surface yet (product does not enforce multi-user). */
const HIDDEN_LIMIT_KEYS = new Set(["staff", "users", "seats", "teamMembers"]);

type FeatureInfo = {
  description: string;
  label: string;
};

const FEATURE_CATALOG: Record<string, FeatureInfo> = {
  analytics: {
    label: "Insights & analytics",
    description: "Overview metrics and sales trends for this shop.",
  },
  managedCheckout: {
    label: "Managed checkout",
    description: "Hosted checkout with delivery and pickup options.",
  },
  localDelivery: {
    label: "Local delivery tools",
    description: "Delivery fees, zones, and phone confirmation at checkout.",
  },
  freeForever: {
    label: "Free forever",
    description: "No subscription payment required on this plan.",
  },
  trial: {
    label: "Trial access",
    description: "Temporary access to plan tools.",
  },
};

export function BillingWorkspace({
  summary,
}: {
  summary: MerchantDashboardSummary;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const busy = isPending;

  const billing = summary.billing;
  const subscription = billing?.subscription;
  const plan = billing?.plan;
  const isFree =
    plan?.isFree === true || (plan?.price != null && Number(plan.price) === 0);
  const isTrialing = subscription?.status === "trialing";
  const isActivePaid =
    !isFree && (subscription?.status === "active" || subscription?.status === "past_due");
  const planLimits = filterLimits(asRecord(plan?.limits));
  const planFeatures = filterFeatures(asRecord(plan?.features), isTrialing);
  const invoices = billing?.invoices ?? [];
  /** Hide legacy free/trial credits; only real money invoices matter to merchants. */
  const visibleInvoices = invoices.filter((invoice) => {
    const amount = Number(invoice.amount);
    if (invoice.provider === "trial") return false;
    if (Number.isFinite(amount) && amount === 0 && invoice.status === "paid") return false;
    return true;
  });
  const paidPlans = billing?.availablePaidPlans ?? [];
  const pendingInvoices = visibleInvoices.filter((invoice) => invoice.status === "pending");

  if (billing?.unavailable) {
    return (
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyTitle>Billing is not active for this shop</EmptyTitle>
          <EmptyDescription>
            No plan or invoice data is available for this shop yet.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const periodStartLabel = isFree ? "Started" : isTrialing ? "Trial started" : "Period started";
  const periodEndLabel = isFree ? "Renewal" : isTrialing ? "Trial ends" : "Current period ends";
  const periodStart = subscription?.currentPeriodStart
    ? formatDate(subscription.currentPeriodStart)
    : "—";
  const periodEnd = isFree
    ? "Not required"
    : subscription?.currentPeriodEnd
      ? formatDate(subscription.currentPeriodEnd)
      : "—";

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
          toast.error(
            mapPlatformErrorMessage(
              typeof data?.error === "string" ? data.error : "billing_unavailable",
            ),
          );
          return;
        }

        if (typeof data?.checkoutUrl === "string" && data.checkoutUrl) {
          toast.success("Redirecting to Chapa…");
          window.location.href = data.checkoutUrl;
          return;
        }

        toast.success("Invoice ready. You can pay with Chapa below.");
        router.refresh();
      } catch {
        toast.error(mapPlatformErrorMessage("platform_request_failed"));
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Plan for {summary.tenant.name}
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight">
            {plan?.name ?? "Plan unavailable"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {plan?.price != null ? formatPlanPrice(plan.price) : "—"}
            {subscription?.billingCycle && !isFree
              ? ` · ${formatCycle(subscription.billingCycle)}`
              : ""}
            {isFree
              ? " · Free forever"
              : subscription?.currentPeriodEnd
                ? ` · ${periodEndLabel} ${formatDate(subscription.currentPeriodEnd)}`
                : ""}
          </p>
        </div>
        {subscription?.status ? (
          <Badge
            className="w-fit capitalize"
            variant={isFree ? "secondary" : isTrialing ? "secondary" : "default"}
          >
            {isFree ? "Free" : formatStatus(subscription.status)}
          </Badge>
        ) : null}
      </div>

      {isFree ? (
        <Alert>
          <AlertTitle>You are on Starter</AlertTitle>
          <AlertDescription>
            Starter is free for your shop. You can upgrade to Growth when you want a paid plan
            period.
          </AlertDescription>
        </Alert>
      ) : null}

      {pendingInvoices.length > 0 ? (
        <Alert>
          <AlertTitle>Payment due</AlertTitle>
          <AlertDescription>
            You have {pendingInvoices.length} open invoice
            {pendingInvoices.length === 1 ? "" : "s"}. Complete payment to activate or extend your
            paid plan period.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Price" value={plan?.price != null ? formatPlanPrice(plan.price) : "—"} />
        <Metric
          label="Billing cycle"
          value={
            isFree ? "—" : subscription?.billingCycle ? formatCycle(subscription.billingCycle) : "—"
          }
        />
        <Metric label={periodStartLabel} value={periodStart} />
        <Metric label={periodEndLabel} value={periodEnd} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What this plan includes</CardTitle>
              <CardDescription>
                {isFree
                  ? "What comes with free Starter."
                  : isActivePaid
                    ? "Included with your current paid plan."
                    : "Included with this plan."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {planLimits.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {planLimits.map(([key, value]) => (
                    <li className="flex items-center justify-between gap-3 text-sm" key={key}>
                      <span className="text-muted-foreground">{formatLimitLabel(key)}</span>
                      <span className="font-medium tabular-nums">{formatLimitValue(value)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No product limits on this plan.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Included tools</CardTitle>
              <CardDescription>What you can run on this plan today.</CardDescription>
            </CardHeader>
            <CardContent>
              {planFeatures.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {planFeatures.map(([key]) => {
                    const info = FEATURE_CATALOG[key] ?? {
                      label: humanizeKey(key),
                      description: "Included with this plan.",
                    };
                    return (
                      <li className="flex items-start gap-2.5 text-sm" key={key}>
                        <AppIcons.check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div className="min-w-0">
                          <p className="font-medium">{info.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{info.description}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul className="flex flex-col gap-3 text-sm">
                  <li className="flex items-start gap-2.5">
                    <AppIcons.check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div>
                      <p className="font-medium">Catalog, orders, and media</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Core tools for running this shop.
                      </p>
                    </div>
                  </li>
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{isFree ? "Upgrade" : "Quick links"}</CardTitle>
            <CardDescription>
              {isFree
                ? "Move to a paid plan when you are ready."
                : "Shop settings and storefront."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {paidPlans.map((paidPlan) => (
              <Button
                key={paidPlan.id}
                disabled={busy}
                size="sm"
                type="button"
                onClick={() =>
                  runBillingAction({
                    action: "upgrade",
                    planId: paidPlan.id,
                  })
                }
              >
                Upgrade to {paidPlan.name} ({formatPlanPrice(paidPlan.price)})
              </Button>
            ))}
            {pendingInvoices.map((invoice) => (
              <Button
                key={invoice.id}
                disabled={busy}
                size="sm"
                type="button"
                variant="default"
                onClick={() => {
                  const returnUrl = new URL(
                    getTenantScopedPath(dashboardRoutes.billing, summary.tenant.id),
                    window.location.origin,
                  );
                  returnUrl.searchParams.set("paid", "1");
                  runBillingAction({
                    action: "pay",
                    invoiceId: invoice.id,
                    returnUrl: returnUrl.toString(),
                  });
                }}
              >
                Pay {formatMoney(invoice.amount, invoice.currency)} with Chapa
              </Button>
            ))}
            <Button asChild className="justify-start" size="sm" variant="outline">
              <Link href={dashboardRoutes.settings}>Shop settings</Link>
            </Button>
            <Button asChild className="justify-start" size="sm" variant="outline">
              <a href={`//${summary.domain.hostname}`} rel="noreferrer" target="_blank">
                <AppIcons.externalLink data-icon="inline-start" />
                View storefront
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>
            {visibleInvoices.length === 0
              ? isFree
                ? "No charges on Starter. Invoices appear when you upgrade to a paid plan."
                : "No invoices yet for this shop."
              : "Payment history and open charges for this shop."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {visibleInvoices.length > 0 ? (
            visibleInvoices.map((invoice) => (
              <div
                className="grid gap-3 rounded-xl border px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center"
                key={invoice.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {invoiceLabel(invoice)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {invoice.paidAt
                      ? `Paid ${formatDate(invoice.paidAt)}`
                      : invoice.dueAt
                        ? `Due ${formatDate(invoice.dueAt)}`
                        : `Created ${formatDate(invoice.createdAt)}`}
                  </p>
                </div>
                <span className="font-mono tabular-nums sm:text-right">
                  {formatMoney(invoice.amount, invoice.currency)}
                </span>
                <Badge className="w-fit capitalize" variant="secondary">
                  {invoiceStatusLabel(invoice.status)}
                </Badge>
                {invoice.status === "pending" ? (
                  <Button
                    disabled={busy}
                    size="sm"
                    type="button"
                    onClick={() => {
                      const returnUrl = new URL(
                        getTenantScopedPath(dashboardRoutes.billing, summary.tenant.id),
                        window.location.origin,
                      );
                      returnUrl.searchParams.set("paid", "1");
                      runBillingAction({
                        action: "pay",
                        invoiceId: invoice.id,
                        returnUrl: returnUrl.toString(),
                      });
                    }}
                  >
                    Pay
                  </Button>
                ) : (
                  <span className="hidden sm:block" />
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              {isFree
                ? "Nothing to pay while you are on Starter."
                : "No invoices yet for this shop."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function filterLimits(limits: Record<string, unknown>) {
  return Object.entries(limits).filter(([key]) => !HIDDEN_LIMIT_KEYS.has(key));
}

function filterFeatures(features: Record<string, unknown>, isTrialing: boolean) {
  return Object.entries(features).filter(([key, enabled]) => {
    if (!enabled) return false;
    if (key === "trial" && isTrialing) return false;
    return true;
  });
}

function formatLimitLabel(key: string) {
  if (key === "products") return "Products";
  if (key === "storefrontEvents") return "Storefront events / month";
  return humanizeKey(key);
}

function formatCycle(cycle: string) {
  if (cycle === "monthly") return "Monthly";
  if (cycle === "yearly" || cycle === "annual") return "Yearly";
  return cycle;
}

function formatStatus(status: string) {
  if (status === "trialing") return "Trialing";
  if (status === "active") return "Active";
  if (status === "past_due") return "Past due";
  if (status === "canceled" || status === "cancelled") return "Canceled";
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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatLimitValue(value: unknown) {
  if (typeof value === "number") {
    return value.toLocaleString();
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return "—";
}

function invoiceLabel(invoice: {
  provider: string | null;
  status: string;
}) {
  if (invoice.provider === "chapa") return "Plan payment";
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
