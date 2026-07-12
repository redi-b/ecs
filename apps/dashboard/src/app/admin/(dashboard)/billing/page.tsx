import { headers } from "next/headers";
import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { dashboardRoutes } from "@/lib/routes";

type BillingPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const result = await getMerchantDashboardSummary({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });

  const billing = result.ok ? result.summary.billing : null;
  const subscription = billing?.subscription;
  const plan = billing?.plan;
  const isTrialing = subscription?.status === "trialing";
  const planLimits = asRecord(plan?.limits);
  const planFeatures = asRecord(plan?.features);

  return (
    <PageShell
      description="Review your plan, trial or subscription status, and invoices."
      title="Billing"
    >
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Billing could not be loaded</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : billing?.unavailable ? (
        <Empty className="min-h-96 border">
          <EmptyHeader>
            <EmptyTitle>Billing is not active for this shop</EmptyTitle>
            <EmptyDescription>
              The account is reachable, but no subscription or invoice state is available yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)]">
          <div className="flex flex-col gap-4">
            {isTrialing ? (
              <Alert>
                <AlertTitle>Starter trial is active</AlertTitle>
                <AlertDescription>
                  Your shop includes a free Starter trial
                  {subscription?.currentPeriodEnd
                    ? ` through ${formatDate(subscription.currentPeriodEnd)}`
                    : ""}
                  . Contact support when you are ready to continue on a paid plan.
                </AlertDescription>
              </Alert>
            ) : null}

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>{plan?.name ?? "Current plan"}</CardTitle>
                    <CardDescription>{result.summary.tenant.name}</CardDescription>
                  </div>
                  {subscription?.status ? (
                    <Badge className="capitalize" variant={isTrialing ? "secondary" : "outline"}>
                      {subscription.status}
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <BillingRow
                  label="Price"
                  value={
                    plan?.price != null
                      ? formatPlanPrice(plan.price)
                      : "Unavailable"
                  }
                />
                <BillingRow
                  label="Cycle"
                  value={subscription?.billingCycle ?? "Unavailable"}
                />
                <BillingRow
                  label="Manual payment"
                  value={subscription?.manualPaymentState ?? "Unavailable"}
                />
                <BillingRow
                  label="Period starts"
                  value={
                    subscription?.currentPeriodStart
                      ? formatDate(subscription.currentPeriodStart)
                      : "—"
                  }
                />
                <BillingRow
                  label={isTrialing ? "Trial ends" : "Period ends"}
                  value={
                    subscription?.currentPeriodEnd
                      ? formatDate(subscription.currentPeriodEnd)
                      : "—"
                  }
                />
                <Separator />
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Plan limits</p>
                  {Object.keys(planLimits).length > 0 ? (
                    <ul className="grid gap-1 text-sm text-muted-foreground">
                      {Object.entries(planLimits).map(([key, value]) => (
                        <li className="flex items-center justify-between gap-3" key={key}>
                          <span className="capitalize">{humanizeKey(key)}</span>
                          <span className="font-medium text-foreground tabular-nums">
                            {formatLimitValue(value)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No limits published for this plan.</p>
                  )}
                </div>
                {Object.keys(planFeatures).length > 0 ? (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-2">
                      <p className="text-sm font-medium">Included features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(planFeatures)
                          .filter(([, enabled]) => Boolean(enabled))
                          .map(([key]) => (
                            <Badge className="capitalize" key={key} variant="secondary">
                              {humanizeKey(key)}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  </>
                ) : null}
                <Separator />
                <Link
                  className="text-sm text-muted-foreground hover:text-foreground"
                  href={dashboardRoutes.settings}
                >
                  Manage shop settings
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>
                Trial and subscription invoices for this shop. Paid invoices extend the active period.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(billing?.invoices.length ?? 0) > 0 ? (
                billing?.invoices.map((invoice) => (
                  <div
                    className="grid gap-3 rounded-lg border px-3 py-2 text-sm md:grid-cols-[1fr_auto_auto]"
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
                    <span className="font-mono tabular-nums">
                      {formatMoney(invoice.amount, invoice.currency)}
                    </span>
                    <Badge className="capitalize" variant="secondary">
                      {invoice.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No invoices have been recorded yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}

function BillingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate font-medium capitalize">{value}</span>
    </div>
  );
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
    .toLowerCase();
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
