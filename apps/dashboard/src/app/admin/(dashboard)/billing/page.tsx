import { cookies, headers } from "next/headers";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BillingWorkspace } from "@/features/billing/billing-workspace";
import {
  billingReturnPaidFlag,
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

type BillingPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const returnedFromPayment = billingReturnPaidFlag(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieHeader = (await cookies()).toString();
  const platformApiBaseUrl = getPlatformApiBaseUrl(
    process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
  );

  // After Chapa return_url, re-verify pending invoices (callback often cannot
  // reach local lvh.me from Chapa's servers).
  if (returnedFromPayment && tenantId) {
    try {
      const confirmUrl = new URL(
        `platform/tenants/${encodeURIComponent(tenantId)}/billing/confirm`,
        platformApiBaseUrl,
      );
      await fetch(confirmUrl, {
        method: "POST",
        headers: {
          accept: "application/json",
          cookie: cookieHeader,
        },
        cache: "no-store",
      });
    } catch {
      // Non-blocking; page still loads billing state.
    }
  }

  const result = await getMerchantDashboardSummary({
    cookieHeader,
    platformApiBaseUrl,
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    tenantId,
  });

  return (
    <PageShell description="Manage your shop plan and payments." title="Billing">
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Billing could not be loaded</AlertTitle>
          <AlertDescription>
            {mapPlatformErrorMessage(result.message)}
          </AlertDescription>
        </Alert>
      ) : (
        <BillingWorkspace
          returnedFromPayment={returnedFromPayment}
          summary={result.summary}
          billingPath={getTenantScopedPath("/admin/billing", tenantId ?? result.summary.tenant.id)}
        />
      )}
    </PageShell>
  );
}
