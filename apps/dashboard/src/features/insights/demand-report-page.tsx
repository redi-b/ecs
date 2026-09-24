import { headers } from "next/headers";
import { insightsDemandQuerySchema } from "@ecs/contracts";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getInsightsDemand } from "@/lib/insights-sales";
import { defaultSalesRange } from "./sales-report-model";
import { InsightsReportNav } from "./insights-report-nav";
import { DemandReport } from "./demand-report";
import { ReportRecovery } from "./report-recovery";

export async function DemandReportPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams> | undefined;
}) {
  const params = (await searchParams) ?? {};
  const [requestHeaders, t] = await Promise.all([headers(), getTranslations()]);
  const defaults = defaultSalesRange(new Date());
  const query = insightsDemandQuerySchema.safeParse({
    from: params.from ?? defaults.from,
    to: params.to ?? defaults.to,
    comparison: "none",
    page: params.demandPage ?? 1,
    q: params.demandSearch ?? "",
    sort: params.demandSort ?? "views",
  });
  const result = query.success
    ? await getInsightsDemand({
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
        <DemandReport report={result.report} />
      ) : (
        <div className="flex flex-col items-start gap-4">
          <Alert variant="destructive">
            <AlertDescription>
              {t(
                result.status === 400
                  ? "insights.salesWorkspace.invalidRange"
                  : result.status === 403
                    ? "insights.salesWorkspace.forbidden"
                    : "insights.demand.failed",
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
