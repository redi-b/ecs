import { headers } from "next/headers";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BillingWorkspace } from "@/features/billing/billing-workspace";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";

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
      description="Review your plan, prepaid invoices, and Chapa payments for this shop."
      title="Billing"
    >
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Billing could not be loaded</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      ) : (
        <BillingWorkspace summary={result.summary} />
      )}
    </PageShell>
  );
}
