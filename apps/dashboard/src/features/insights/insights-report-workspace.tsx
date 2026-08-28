"use client";

import type { MerchantDashboardSummary } from "@ecs/contracts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/i18n/provider";

export type InsightsReport = "sales" | "storefront" | "products" | "customers";

export function InsightsReportWorkspace({
  report,
  summary,
}: {
  report: InsightsReport;
  summary: MerchantDashboardSummary;
}) {
  if (report === "storefront") return <StorefrontReport summary={summary} />;
  if (report === "products") return <ProductsReport summary={summary} />;
  if (report === "customers") return <CustomersReport summary={summary} />;
  return <SalesReport summary={summary} />;
}

function SalesReport({ summary }: { summary: MerchantDashboardSummary }) {
  const { formatNumber, locale, t } = useI18n();
  const operations = summary.operations;
  const totals = operations?.totals;
  const currency = totals?.currencyCode?.toUpperCase() ?? "ETB";
  const average = totals?.orders && totals.revenue != null ? totals.revenue / totals.orders : null;
  return (
    <ReportSection period={t("insights.period.ninetyDays")}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportMetric
          label={t("insights.metrics.revenue")}
          value={money(totals?.revenue, currency, locale)}
        />
        <ReportMetric
          label={t("insights.metrics.orders")}
          value={formatNumber(totals?.orders ?? 0)}
        />
        <ReportMetric
          label={t("insights.metrics.averageOrder")}
          value={money(average, currency, locale)}
        />
        <Breakdown
          title={t("insights.reports.paymentStatus")}
          rows={operations?.breakdowns.paymentStatus ?? []}
        />
        <Breakdown
          title={t("insights.reports.fulfillmentStatus")}
          rows={operations?.breakdowns.fulfillmentStatus ?? []}
        />
        <Breakdown
          title={t("insights.reports.orderStatus")}
          rows={operations?.breakdowns.orderStatus ?? []}
        />
      </section>
    </ReportSection>
  );
}

function StorefrontReport({ summary }: { summary: MerchantDashboardSummary }) {
  const { formatNumber, t } = useI18n();
  const activity = summary.analytics?.storefront;
  const values = [
    ["visits", activity?.visits],
    ["pageViews", activity?.pageViews],
    ["productViewVisits", activity?.productViewVisits],
    ["addToCartVisits", activity?.addToCartVisits],
    ["checkoutVisits", activity?.checkoutVisits],
    ["searchVisits", activity?.searchVisits],
  ] as const;
  return (
    <ReportSection period={t("insights.period.thirtyDays")}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {values.map(([key, value]) => (
          <ReportMetric
            key={key}
            label={t(`insights.reports.storefrontMetrics.${key}`)}
            value={formatNumber(value ?? 0)}
          />
        ))}
      </section>
      <Card>
        <CardHeader>
          <CardTitle>{t("insights.funnel.title")}</CardTitle>
          <CardDescription>{t("insights.funnel.disclaimer")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(summary.analytics?.funnel ?? []).map((stage) => (
            <div className="rounded-xl border p-4" key={stage.key}>
              <p className="text-sm text-muted-foreground">
                {t(`insights.reports.funnel.${stage.key}`)}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {formatNumber(stage.count)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </ReportSection>
  );
}

function ProductsReport({ summary }: { summary: MerchantDashboardSummary }) {
  const { formatNumber, t } = useI18n();
  const products = summary.analytics?.products ?? [];
  return (
    <ReportSection period={t("insights.period.thirtyDays")}>
      <Card>
        <CardHeader>
          <CardTitle>{t("insights.reports.productInterest")}</CardTitle>
          <CardDescription>{t("insights.reports.productInterestDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length ? (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="bg-muted/45 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t("insights.reports.product")}</th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("insights.reports.viewVisits")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("insights.reports.addToCartVisits")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((product) => (
                    <tr className="transition-colors hover:bg-muted/30" key={product.productId}>
                      <td className="px-4 py-3 font-medium">{humanize(product.productId)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(product.viewVisits)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(product.addToCartVisits)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t("insights.reports.noProductActivity")}
            </p>
          )}
        </CardContent>
      </Card>
    </ReportSection>
  );
}

function CustomersReport({ summary }: { summary: MerchantDashboardSummary }) {
  const { formatNumber, t } = useI18n();
  const customers = summary.operations?.customers;
  const orders = summary.operations?.totals.orders ?? 0;
  return (
    <ReportSection period={t("insights.period.ninetyDays")}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ReportMetric
          label={t("insights.reports.customersUnique")}
          value={formatNumber(customers?.unique ?? 0)}
        />
        <ReportMetric
          label={t("insights.reports.customersReturning")}
          value={formatNumber(customers?.repeat ?? 0)}
        />
        <ReportMetric label={t("insights.metrics.orders")} value={formatNumber(orders)} />
      </section>
    </ReportSection>
  );
}

function ReportSection({ children, period }: { children: React.ReactNode; period: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <span className="rounded-full border bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
          {period}
        </span>
      </div>
      {children}
    </div>
  );
}

function ReportMetric({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ count: number; label: string }>;
}) {
  const { formatNumber } = useI18n();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row) => (
          <div className="flex items-center justify-between gap-4" key={row.label}>
            <span className="text-sm text-muted-foreground">{humanize(row.label)}</span>
            <span className="font-medium tabular-nums">{formatNumber(row.count)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function humanize(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function money(value: number | null | undefined, currency: string, locale: string) {
  return value == null
    ? "—"
    : new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
}
