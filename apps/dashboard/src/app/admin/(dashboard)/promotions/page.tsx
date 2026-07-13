import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PromotionCreateDialog } from "@/features/promotions/promotion-create-dialog";
import { PromotionsManager } from "@/features/promotions/promotions-manager";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getMerchantPromotions } from "@/lib/merchant-promotions";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type PromotionsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function PromotionsPage({ searchParams }: PromotionsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const offset = (listParams.page - 1) * listParams.pageSize;
  const requestHeaders = await headers();
  const result = await getMerchantPromotions({
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    ...(listParams.q ? { query: listParams.q } : {}),
  });

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <PromotionCreateDialog />
        </>
      }
      description="Create intentional discounts with clear schedules and redemption safeguards."
      title="Promotions & discounts"
    >
      {result.ok ? (
        <>
          <ListSummary count={result.promotions.count} label="promotions" />
          <PromotionsManager
            footer={
              <PaginationControls
                basePath={dashboardRoutes.promotions}
                count={result.promotions.count}
                page={listParams.page}
                pageSize={listParams.pageSize}
                searchParams={resolvedSearchParams}
              />
            }
            initialQuery={listParams.q}
            promotions={result.promotions.promotions}
            totalCount={result.promotions.count}
          />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Promotions could not be loaded</AlertTitle>
          <AlertDescription>
            The promotions list is temporarily unavailable. Refresh and try again.
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
