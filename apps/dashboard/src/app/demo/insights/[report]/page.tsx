import { notFound } from "next/navigation";

import { DemoInsights } from "@/features/demo/dashboard-demo-sections";
import type { InsightsReport } from "@/features/insights/insights-report-workspace";

const reports = new Set<InsightsReport>(["sales", "journey", "traffic"]);

export default async function Page({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!reports.has(report as InsightsReport)) notFound();
  return <DemoInsights report={report as InsightsReport} />;
}
