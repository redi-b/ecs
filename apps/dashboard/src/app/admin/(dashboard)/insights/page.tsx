import { RiBarChartGroupedLine } from "@remixicon/react";
import Link from "@/components/app/link";

import { PageShell } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getTranslations } from "@/i18n/server";
import { dashboardRoutes } from "@/lib/routes";

export default async function InsightsPage() {
  const t = await getTranslations();

  return (
    <PageShell description={t("insights.description")} title={t("insights.title")}>
      <Empty className="min-h-96 border border-dashed bg-muted/15">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiBarChartGroupedLine />
          </EmptyMedia>
          <EmptyTitle>{t("insights.empty.title")}</EmptyTitle>
          <EmptyDescription>{t("insights.empty.description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild size="sm" variant="outline">
            <Link href={dashboardRoutes.overview} prefetch={false}>
              {t("insights.empty.cta")}
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </PageShell>
  );
}
