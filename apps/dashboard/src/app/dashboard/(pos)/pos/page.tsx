import { headers } from "next/headers";
import { QuickSaleWorkspace } from "@/features/quick-sale/quick-sale-workspace";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";
import { listMerchantSaleDrafts } from "@/lib/platform-api/orders/sale-drafts";

export default async function QuickSalePage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const requestHeaders = await headers();
  const drafts = await listMerchantSaleDrafts({
    channel: "pos",
    cookieHeader: requestHeaders.get("cookie"),
    limit: 8,
    offset: 0,
    platformApiBaseUrl: getPlatformApiBaseUrl(),
    requestHost: requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
  });
  const rawDraftId = params?.draft;
  const draftId = Array.isArray(rawDraftId) ? rawDraftId[0] : rawDraftId;

  return (
    <QuickSaleWorkspace
      initialDraftId={draftId?.trim() || null}
      initialDrafts={drafts.ok ? drafts.drafts : []}
    />
  );
}
