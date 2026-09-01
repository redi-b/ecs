import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { InquiryInbox } from "@/features/inquiries/inquiry-inbox";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getStorefrontInquiries } from "@/lib/platform-api/inquiries/client";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const list = parseListSearchParams(params);
  const tenantId = getSelectedTenantId(params);
  const requestHeaders = await headers();
  const q = typeof params.q === "string" ? params.q : undefined;
  const status = typeof params.status === "string" ? params.status : undefined;
  const type = typeof params.type === "string" ? params.type : undefined;
  const result = await getStorefrontInquiries({
    cookieHeader: requestHeaders.get("cookie"),
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
    limit: list.pageSize,
    offset: (list.page - 1) * list.pageSize,
    q,
    status,
    type,
  });

  return (
    <PageShell title="Inquiries" actions={<RefreshButton />}>
      {result.ok ? (
        <>
          <ListSummary
            count={result.count}
            filtered={Boolean(q || status || type)}
            page={list.page}
            pageSize={result.limit}
          />
          <InquiryInbox inquiries={result.inquiries} {...(tenantId ? { tenantId } : {})} />
          <PaginationControls
            basePath={dashboardRoutes.inquiries}
            count={result.count}
            page={list.page}
            pageSize={result.limit}
            searchParams={params}
          />
        </>
      ) : (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
          <h2 className="font-semibold">Couldn’t load inquiries</h2>
          <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
        </div>
      )}
    </PageShell>
  );
}
