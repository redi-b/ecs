import { headers } from "next/headers";
import { insightsStorefrontQuerySchema } from "@ecs/contracts";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getInsightsStorefront } from "@/lib/insights-sales";
import { defaultSalesRange } from "./sales-report-model";
import { InsightsReportNav } from "./insights-report-nav";
import { StorefrontReport } from "./storefront-report";
import { ReportRecovery } from "./report-recovery";

export async function StorefrontReportPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams> | undefined;
}) {
  const params = (await searchParams) ?? {};
  const requestHeaders = await headers();
  const t = await getTranslations();
  const defaults = defaultSalesRange(new Date());
  const query = insightsStorefrontQuerySchema.safeParse({
    from: params.from ?? defaults.from,
    to: params.to ?? defaults.to,
    comparison: params.comparison ?? "none",
    stage: params.stage ?? "pages",
    page: params.pathPage ?? 1,
    q: params.pathSearch ?? "",
    trafficDimension: params.trafficDimension ?? "referrer",
    trafficPage: params.trafficPage ?? 1,
    trafficSearch: params.trafficSearch ?? "",
  });
  const result = query.success
    ? await getInsightsStorefront({
        cookieHeader: requestHeaders.get("cookie"),
        requestHost: requestHeaders.get("host"),
        tenantId: getSelectedTenantId(params),
        query: query.data,
      })
    : { ok: false as const, status: 400 };
  return (
    <PageShell title={t("insights.title")}>
      <InsightsReportNav />
      {result.ok ? (
        <StorefrontReport report={result.report} />
      ) : (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="destructive">
            <AlertDescription>
              {t(
                result.status === 400
                  ? "insights.salesWorkspace.invalidRange"
                  : result.status === 403
                    ? "insights.salesWorkspace.forbidden"
                    : "insights.storefrontReport.failed",
              )}
            </AlertDescription>
          </Alert>
          {result.status !== 403 ? (
            <ReportRecovery invalid={result.status === 400} {...defaults} />
          ) : null}
        </div>
      )}
    </PageShell>
  );
}
