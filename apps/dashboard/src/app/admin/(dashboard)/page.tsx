import { headers } from "next/headers";
import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MerchantOverview } from "@/features/overview/merchant-overview";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { dashboardRoutes } from "@/lib/routes";

type MerchantAdminPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantAdminPage({ searchParams }: MerchantAdminPageProps) {
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
      actions={
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={dashboardRoutes.orders}>Orders</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={dashboardRoutes.products}>Products</Link>
          </Button>
        </div>
      }
      description="Merchant dashboard foundation for operational commerce workflows. The overview reflects live tenant, commerce, storefront, and operator readiness from the Platform API."
      title="Overview"
    >
      {result.ok ? (
        <MerchantOverview summary={result.summary} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Overview could not be loaded</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
