import { notFound } from "next/navigation";

import { InsightsPage } from "@/features/insights/insights-page";
import { StorefrontReportPage } from "@/features/insights/storefront-report-page";
import { DemandReportPage } from "@/features/insights/demand-report-page";
import type { InsightsReport } from "@/features/insights/insights-report-workspace";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";

const reports = new Set<InsightsReport>(["sales", "journey", "traffic"]);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const { report } = await params;
  if (report === "products") return <DemandReportPage searchParams={searchParams} />;
  if (report === "storefront" || report === "journey" || report === "traffic")
    return <StorefrontReportPage searchParams={searchParams} />;
  if (!reports.has(report as InsightsReport)) notFound();
  return <InsightsPage report={report as InsightsReport} searchParams={searchParams} />;
}
