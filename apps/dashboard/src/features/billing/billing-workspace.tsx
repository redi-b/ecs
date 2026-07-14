import Link from "@/components/app/link";

import { AppIcons } from "@/components/app/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import type { MerchantDashboardSummary } from "@ecs/contracts";
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
  trial: {
    label: "Trial access",
    description: "Temporary access to Starter plan tools.",
  },
};

export function BillingWorkspace({
  summary,
}: {
  summary: MerchantDashboardSummary;
}) {
  const billing = summary.billing;
  const subscription = billing?.subscription;
  const plan = billing?.plan;
  const isTrialing = subscription?.status === "trialing";
  const isActivePaid = subscription?.status === "active" || subscription?.status === "past_due";
  const planLimits = filterLimits(asRecord(plan?.limits));
  const planFeatures = filterFeatures(asRecord(plan?.features), isTrialing);
  const invoices = billing?.invoices ?? [];

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

  const periodStartLabel = isTrialing ? "Trial started" : "Period started";
  const periodEndLabel = isTrialing ? "Trial ends" : "Next due";
  const periodStart = subscription?.currentPeriodStart
    ? formatDate(subscription.currentPeriodStart)
    : "—";
  const periodEnd = subscription?.currentPeriodEnd
    ? formatDate(subscription.currentPeriodEnd)
    : "—";

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
            {subscription?.billingCycle ? ` · ${formatCycle(subscription.billingCycle)}` : ""}
            {subscription?.currentPeriodEnd
              ? ` · ${periodEndLabel} ${formatDate(subscription.currentPeriodEnd)}`
              : ""}
          </p>
        </div>
        {subscription?.status ? (
          <Badge className="w-fit capitalize" variant={isTrialing ? "secondary" : "default"}>
            {formatStatus(subscription.status)}
          </Badge>
        ) : null}
      </div>

      {isTrialing ? (
        <Alert>
          <AlertTitle>Starter trial is active</AlertTitle>
          <AlertDescription>
            Free trial
            {subscription?.currentPeriodEnd
              ? ` through ${formatDate(subscription.currentPeriodEnd)}`
              : ""}
            . To continue on a paid plan, contact support and include shop handle{" "}
            <span className="font-medium text-foreground">{summary.tenant.handle}</span>.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Price" value={plan?.price != null ? formatPlanPrice(plan.price) : "—"} />
        <Metric
          label="Billing cycle"
          value={subscription?.billingCycle ? formatCycle(subscription.billingCycle) : "—"}
        />
        {/* Timeline left → right: start then end/due */}
        <Metric label={periodStartLabel} value={periodStart} />
        <Metric label={periodEndLabel} value={periodEnd} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">What this plan includes</CardTitle>
              <CardDescription>
                {isTrialing
                  ? "Usage limits during your trial."
                  : isActivePaid
                    ? "Usage limits on your current paid plan."
                    : "Usage limits attached to this plan."}
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
            <CardTitle className="text-base">Need help?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild className="justify-start rounded-full" size="sm" variant="outline">
              <Link href={dashboardRoutes.settings}>Shop settings</Link>
            </Button>
            <Button asChild className="justify-start rounded-full" size="sm" variant="outline">
              <a href={`//${summary.domain.hostname}`} rel="noreferrer" target="_blank">
                <AppIcons.externalLink data-icon="inline-start" />
                View storefront
              </a>
            </Button>
            <p className="pt-1 text-xs text-muted-foreground">
              Plan changes and invoices are handled by support for now. Share your shop handle when
              you reach out.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Invoices</CardTitle>
          <CardDescription>
            Charges and trial credits for this shop. Paid items extend your active period.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {invoices.length > 0 ? (
            invoices.map((invoice) => (
              <div
                className="grid gap-3 rounded-xl border px-3 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                key={invoice.id}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {invoice.provider === "trial" ? "Trial credit" : shortId(invoice.id)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDate(invoice.createdAt)}
                    {invoice.dueAt ? ` · Due ${formatDate(invoice.dueAt)}` : ""}
                    {invoice.paidAt ? ` · Paid ${formatDate(invoice.paidAt)}` : ""}
                  </p>
                </div>
                <span className="font-mono tabular-nums sm:text-right">
                  {formatMoney(invoice.amount, invoice.currency)}
                </span>
                <Badge className="w-fit capitalize" variant="secondary">
                  {invoice.status}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No invoices yet for this shop.</p>
          )}
          <Separator className="my-1" />
          <p className="text-xs text-muted-foreground">
            Need a copy of an invoice or a payment receipt? Contact support with your shop handle
            and we will send it to you.
          </p>
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
    // Redundant with the trial badge when already trialing.
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
    return new Intl.NumberFormat("en").format(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value == null) return "—";
  return String(value);
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}
