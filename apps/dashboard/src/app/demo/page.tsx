import type { Metadata } from "next";

import { dashboardDemoFixture } from "@/features/demo/dashboard-demo-fixture";
import { DemoOverviewHighlights } from "@/features/demo/dashboard-demo-sections";
import { DemoPageHeader } from "@/features/demo/dashboard-demo-shell";
import { DemoInteractionBoundary } from "@/features/demo/demo-interaction-boundary";
import { MerchantOverview } from "@/features/overview/merchant-overview";

export const metadata: Metadata = {
  title: "Merchant dashboard preview",
  robots: { follow: false, index: false },
};

export default function DemoOverviewPage() {
  return (
    <DemoInteractionBoundary notice="This preview does not make changes.">
      <DemoPageHeader
        title="Good morning, Meron"
        description="A practical view of the shop, current activity, and the work that needs attention."
      />
      <DemoOverviewHighlights />
      <MerchantOverview demoMode summary={dashboardDemoFixture} />
    </DemoInteractionBoundary>
  );
}
