import { headers } from "next/headers";
import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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

  return (
    <PageShell
      description="Tenant billing status, plan information, and recent invoices from the Platform API."
      title="Billing"
    >
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Billing could not be loaded</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : result.summary.billing?.unavailable ? (
        <Empty className="min-h-96 border">
          <EmptyHeader>
            <EmptyTitle>Billing is not active for this shop</EmptyTitle>
            <EmptyDescription>
              The account is reachable, but no subscription or invoice state is available yet.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{result.summary.billing?.plan?.name ?? "Current plan"}</CardTitle>
              <CardDescription>{result.summary.tenant.name}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <BillingRow label="Price" value={result.summary.billing?.plan?.price ?? "Unavailable"} />
              <BillingRow
                label="Cycle"
                value={result.summary.billing?.subscription?.billingCycle ?? "Unavailable"}
              />
              <BillingRow
                label="Subscription"
                value={result.summary.billing?.subscription?.status ?? "Unavailable"}
              />
              <BillingRow
                label="Manual payment"
                value={result.summary.billing?.subscription?.manualPaymentState ?? "Unavailable"}
              />
              <Separator />
              <Link className="text-sm text-muted-foreground hover:text-foreground" href={dashboardRoutes.settings}>
                Manage shop settings
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoices</CardTitle>
              <CardDescription>Recent tenant invoices and payment state.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(result.summary.billing?.invoices.length ?? 0) > 0 ? (
                result.summary.billing?.invoices.map((invoice) => (
                  <div
                    className="grid gap-3 rounded-lg border px-3 py-2 text-sm md:grid-cols-[1fr_auto_auto]"
                    key={invoice.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invoice.id}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatDate(invoice.createdAt)}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums">
                      {invoice.amount} {invoice.currency.toUpperCase()}
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
