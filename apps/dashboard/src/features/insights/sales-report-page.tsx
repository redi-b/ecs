import { headers } from "next/headers";
import { insightsSalesQuerySchema, insightsProductsQuerySchema } from "@ecs/contracts";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getInsightsSales, getInsightsProducts } from "@/lib/insights-sales";
import { InsightsHeaderActions } from "./insights-header-actions";
import { InsightsReportNav } from "./insights-report-nav";
import { defaultSalesRange } from "./sales-report-model";
import { SalesReport } from "./sales-report";
import { SalesProductContributions } from "./sales-product-contributions";

export async function SalesReportPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams> | undefined;
}) {
  const params = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(params);
  const t = await getTranslations();
  const requestHeaders = await headers();
  const defaults = defaultSalesRange(new Date());
  const query = insightsSalesQuerySchema.safeParse({
    from: params.from ?? defaults.from,
    to: params.to ?? defaults.to,
    comparison: params.comparison ?? "previous",
  });
  const productQuery = insightsProductsQuerySchema.safeParse({
    ...(query.success ? query.data : {}),
    page: params.productPage ?? 1,
    q: params.productSearch ?? "",
    sort: params.productSort ?? "units",
  });
  const context = {
    cookieHeader: requestHeaders.get("cookie"),
    requestHost: requestHeaders.get("host"),
    tenantId,
  };
  const [result, products] = await Promise.all([
    query.success
      ? getInsightsSales({ ...context, query: query.data })
      : Promise.resolve({ ok: false as const, status: 400 }),
    productQuery.success
      ? getInsightsProducts({ ...context, query: productQuery.data })
      : Promise.resolve({ ok: false as const, status: 400 }),
  ]);
  return (
    <PageShell
      title={t("insights.title")}
      actions={result.ok ? <InsightsHeaderActions report={result.report} /> : null}
    >
      <InsightsReportNav />
      {result.ok ? (
        <SalesReport
          key={`${result.report.range.from}:${result.report.range.to}:${result.report.previousRange?.from ?? "none"}`}
          report={result.report}
        >
          <SalesProductContributions
            report={products.ok ? products.report : null}
            failed={!products.ok}
          />
        </SalesReport>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{t("insights.error.title")}</AlertTitle>
          <AlertDescription>
            {t(
              result.status === 400
                ? "insights.salesWorkspace.invalidRange"
                : result.status === 403
                  ? "insights.salesWorkspace.forbidden"
                  : "insights.salesWorkspace.unavailable",
            )}
            <a
              className="underline underline-offset-4"
              href={
                tenantId
                  ? `/admin/insights/sales?tenantId=${encodeURIComponent(tenantId)}`
                  : "/admin/insights/sales"
              }
            >
              {t("insights.salesWorkspace.resetRange")}
            </a>
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
