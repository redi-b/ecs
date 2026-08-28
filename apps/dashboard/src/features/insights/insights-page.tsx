import { headers } from "next/headers";

import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InsightsHeaderActions } from "@/features/insights/insights-header-actions";
import { InsightsReportNav } from "@/features/insights/insights-report-nav";
import {
  type InsightsReport,
  InsightsReportWorkspace,
} from "@/features/insights/insights-report-workspace";
import { InsightsWorkspace } from "@/features/insights/insights-workspace";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantDashboardSummary } from "@/lib/merchant-dashboard";
import { mapPlatformErrorMessage } from "@/lib/platform-api/errors";

export async function InsightsPage({
  report,
  searchParams,
}: {
  report: "overview" | InsightsReport;
  searchParams?: Promise<DashboardSearchParams> | undefined;
}) {
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
    <PageShell
      actions={result.ok ? <InsightsHeaderActions summary={result.summary} /> : null}
      description={t(`insights.reports.descriptions.${report}`)}
      title={report === "overview" ? t("insights.title") : t(`insights.reports.${report}`)}
    >
      <InsightsReportNav />
      {!result.ok ? (
        <Alert variant="destructive">
          <AlertTitle>{t("insights.error.title")}</AlertTitle>
          <AlertDescription>
            {mapPlatformErrorMessage(result.message, { resource: "Insights" })}
          </AlertDescription>
        </Alert>
      ) : !result.summary.analytics && !result.summary.operations ? null : report === "overview" ? (
        <InsightsWorkspace summary={result.summary} />
      ) : (
        <InsightsReportWorkspace report={report} summary={result.summary} />
      )}
    </PageShell>
  );
}
