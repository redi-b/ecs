import { RiBarChartGroupedLine } from "@remixicon/react";

import { PageShell } from "@/components/app/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getTranslations } from "@/i18n/server";

export default async function InsightsPage() {
  const t = await getTranslations();

  return (
    <PageShell description={t("insights.description")} title={t("insights.title")}>
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiBarChartGroupedLine />
          </EmptyMedia>
          <EmptyTitle>{t("insights.empty.title")}</EmptyTitle>
          <EmptyDescription>
            {t("insights.empty.description")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
