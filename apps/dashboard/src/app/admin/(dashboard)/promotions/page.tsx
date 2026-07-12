import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PromotionCreateDialog } from "@/features/promotions/promotion-create-dialog";
import { PromotionsManager } from "@/features/promotions/promotions-manager";
import type { MessageKey } from "@/i18n/messages";
import { getRequestMessages } from "@/i18n/server";
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
  const statusRaw = Array.isArray(resolvedSearchParams.status)
    ? resolvedSearchParams.status[0]
    : resolvedSearchParams.status;
  const status =
    statusRaw === "active" || statusRaw === "inactive" || statusRaw === "draft"
      ? statusRaw
      : undefined;
  const { messages } = await getRequestMessages();
  const t = (key: MessageKey) => messages[key];
  const offset = (listParams.page - 1) * listParams.pageSize;
  const requestHeaders = await headers();
  const result = await getMerchantPromotions({
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    ...(listParams.q ? { query: listParams.q } : {}),
    ...(status ? { status } : {}),
  });

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <PromotionCreateDialog />
        </>
      }
      description={t("promotions.description")}
      title={t("promotions.title")}
    >
      {result.ok ? (
        <>
          <ListSummary count={result.promotions.count} label={t("nav.promotions").toLowerCase()} />
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
            initialStatus={status ?? "all"}
            promotions={result.promotions.promotions}
            totalCount={result.promotions.count}
          />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{t("promotions.error.loadTitle")}</AlertTitle>
          <AlertDescription>
            {t("promotions.error.loadDescription")}
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
