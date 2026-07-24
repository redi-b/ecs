import { RiBarChartGroupedLine } from "@remixicon/react";
import Link from "@/components/app/link";

import { PageShell } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getTranslations } from "@/i18n/server";
import { dashboardRoutes } from "@/lib/routes";

export default async function InsightsPage() {
  const t = await getTranslations();

  return (
    <PageShell description={t("insights.description")} title={t("insights.title")}>
      <Empty className="min-h-60 gap-3 rounded-2xl border border-border/80 bg-card/95 p-8 shadow-[0_1px_2px_color-mix(in_oklch,var(--foreground)_4%,transparent)] sm:min-h-72">
        <EmptyHeader className="gap-2.5">
          <span className="text-muted-foreground/80">
            <RiBarChartGroupedLine className="size-5" aria-hidden />
          </span>
          <EmptyTitle className="font-medium">{t("insights.empty.title")}</EmptyTitle>
          <EmptyDescription className="text-sm leading-relaxed">
            {t("insights.empty.description")}
          </EmptyDescription>
        </EmptyHeader>
        <Button asChild size="sm" variant="outline">
          <Link href={dashboardRoutes.overview} prefetch={false}>
            {t("insights.empty.cta")}
          </Link>
        </Button>
      </Empty>
    </PageShell>
  );
}
