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
      description="Deeper reports for traffic, products, and customers."
      title="Insights"
    >
      <Empty className="min-h-96 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <RiBarChartGroupedLine />
          </EmptyMedia>
          <EmptyTitle>Audience insights are coming soon</EmptyTitle>
          <EmptyDescription>
            Use Overview for current sales and storefront signals.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </PageShell>
  );
}
