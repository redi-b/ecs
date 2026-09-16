import { InsightsPage } from "@/features/insights/insights-page";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";

export default function Page({ searchParams }: { searchParams?: Promise<DashboardSearchParams> }) {
  return <InsightsPage report="overview" searchParams={searchParams} />;
}
