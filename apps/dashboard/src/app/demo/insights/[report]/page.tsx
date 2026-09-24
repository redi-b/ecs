import { notFound } from "next/navigation";

import { DemoInsights } from "@/features/demo/dashboard-demo-sections";
import type { InsightsReport } from "@/features/insights/insights-report-workspace";

const reports = new Set<InsightsReport>(["sales", "products", "storefront"]);

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  const { report } = await params;
  if (!reports.has(report as InsightsReport)) notFound();
  return <DemoInsights report={report as InsightsReport} searchParams={searchParams} />;
}
