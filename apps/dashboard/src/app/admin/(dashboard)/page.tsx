import { headers } from "next/headers";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MerchantOverview } from "@/features/overview/merchant-overview";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

type MerchantAdminPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantAdminPage({ searchParams }: MerchantAdminPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const t = await getTranslations();
  const requestHeaders = await headers();
  const result = await getMerchantDashboardSummary({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });

  return (
    <PageShell headerMode="sr-only" title={t("overview.title")}>
      {result.ok ? (
        <MerchantOverview summary={result.summary} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{t("overview.error.loadTitle")}</AlertTitle>
          <AlertDescription>
            {mapPlatformErrorMessage(result.message, { resource: "Dashboard" })}
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
