import type { InsightsReport } from "@/features/insights/insights-report-workspace";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { SalesReportPage } from "./sales-report-page";

export async function InsightsPage({
  report,
  searchParams,
}: {
  report: "overview" | InsightsReport;
  searchParams?: Promise<DashboardSearchParams> | undefined;
}) {
  void report;
  return <SalesReportPage searchParams={searchParams} />;
}
