import { RiBarChartGroupedLine } from "@remixicon/react";

import { PageShell } from "@/components/app/page-shell";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function InsightsPage() {
  return (
    <PageShell
      description="Insights will use verified commerce and storefront events after analytics ingestion exists."
      title="Insights"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiBarChartGroupedLine />
          </EmptyMedia>
          <EmptyTitle>No analytics integration yet</EmptyTitle>
          <EmptyDescription>
            This page avoids placeholder charts or synthetic KPIs until real reporting data is
            available.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
