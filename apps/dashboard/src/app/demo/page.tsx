import type { Metadata } from "next";
import Link from "@/components/app/link";

import { PageShell } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import { dashboardDemoFixture } from "@/features/demo/dashboard-demo-fixture";
import { MerchantOverview } from "@/features/overview/merchant-overview";
import { getTranslations } from "@/i18n/server";

export const metadata: Metadata = {
  title: "Merchant dashboard preview",
  robots: { follow: false, index: false },
};

export default async function DemoOverviewPage() {
  const t = await getTranslations();

  return (
    <PageShell
      actions={
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/demo/orders" prefetch={false}>
              {t("nav.orders")}
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/demo/products" prefetch={false}>
              {t("nav.products")}
            </Link>
          </Button>
        </div>
      }
      description={t("overview.description")}
      title={t("overview.title")}
    >
      <MerchantOverview demoMode summary={dashboardDemoFixture} />
    </PageShell>
  );
}
