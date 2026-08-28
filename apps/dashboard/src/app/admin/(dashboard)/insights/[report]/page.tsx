import { notFound } from "next/navigation";

import { InsightsPage } from "@/features/insights/insights-page";
import type { InsightsReport } from "@/features/insights/insights-report-workspace";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";

const reports = new Set<InsightsReport>(["sales", "storefront", "products", "customers"]);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const { report } = await params;
  if (!reports.has(report as InsightsReport)) notFound();
  return <InsightsPage report={report as InsightsReport} searchParams={searchParams} />;
}
