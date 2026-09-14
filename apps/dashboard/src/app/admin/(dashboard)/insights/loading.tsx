import { ListTableSkeleton } from "@/components/app/list-table-skeleton";
import { PageShell } from "@/components/app/page-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { InsightsReportNav } from "@/features/insights/insights-report-nav";
import { getTranslations } from "@/i18n/server";

export default async function InsightsLoading() {
  const t = await getTranslations();
  return (
    <PageShell title={t("insights.title")}>
      <output className="flex flex-col gap-5" aria-label={t("common.loading")}>
        <InsightsReportNav />
        <div className="flex flex-wrap justify-between gap-3">
          <Skeleton className="h-9 w-72 max-w-full" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="flex flex-col gap-6 rounded-2xl border bg-card p-5">
          <Skeleton className="h-9 w-60 max-w-full" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-72 w-full" />
          <div className="flex gap-8">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <Skeleton className="h-6 w-40" />
        <ListTableSkeleton columns={4} rows={6} />
      </output>
    </PageShell>
  );
}
