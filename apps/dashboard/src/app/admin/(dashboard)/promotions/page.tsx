import { headers } from "next/headers";

import { ListSetupState } from "@/components/app/list-error-state";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PromotionCreateDialog } from "@/features/promotions/promotion-create-dialog";
import { PromotionsManager } from "@/features/promotions/promotions-manager";
import { getTranslations } from "@/i18n/server";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getListErrorState } from "@/lib/list-error-state";
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
  const apply = getPromotionFilter(resolvedSearchParams.apply, ["code", "automatic"] as const);
  const schedule = getPromotionFilter(resolvedSearchParams.schedule, [
    "scheduled",
    "current",
    "expired",
    "unscheduled",
  ] as const);
  const offer = getPromotionFilter(resolvedSearchParams.offer, [
    "order",
    "products",
    "free_shipping",
    "buyget",
    "percentage",
    "fixed",
  ] as const);
  const t = await getTranslations();
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
    ...(apply ? { apply } : {}),
    ...(schedule ? { schedule } : {}),
    ...(offer ? { offer } : {}),
  });
  const errorState = result.ok ? null : getListErrorState("promotions", result.message);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <PromotionCreateDialog />
        </>
      }
      title={t("promotions.title")}
    >
      {result.ok ? (
        <>
          <ListSummary
            count={result.promotions.count}
            filtered={
              Boolean(listParams.q) ||
              Boolean(status) ||
              Boolean(apply) ||
              Boolean(offer) ||
              Boolean(schedule)
            }
            page={listParams.page}
            pageSize={listParams.pageSize}
          />
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
            initialApply={apply ?? "all"}
            initialSchedule={schedule ?? "all"}
            initialOffer={offer ?? "all"}
            initialStatus={status ?? "all"}
            promotions={result.promotions.promotions}
            totalCount={result.promotions.count}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? t("promotions.error.loadTitle")}</AlertTitle>
          <AlertDescription>
            {errorState?.description ?? t("promotions.error.loadDescription")}
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}

function getPromotionFilter<const T extends readonly string[]>(
  value: string | string[] | undefined,
  values: T,
) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return values.includes(candidate as T[number]) ? (candidate as T[number]) : undefined;
}
