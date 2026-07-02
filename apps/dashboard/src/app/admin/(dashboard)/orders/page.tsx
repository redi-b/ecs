import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OrdersTable } from "@/features/orders/orders-table";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getMerchantOrders } from "@/lib/merchant-orders";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type MerchantOrdersPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantOrdersPage({ searchParams }: MerchantOrdersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const offset = (listParams.page - 1) * listParams.pageSize;
  const result = await getMerchantOrders({
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });

  return (
    <PageShell
      description="Track merchant-scoped order data from the Platform API. Fulfillment and payment actions will build on this list foundation."
      title="Orders"
    >
      {result.ok ? (
        <>
          <ListSummary count={result.orders.count} label="orders" />
          <OrdersTable orders={result.orders.orders} />
          <PaginationControls
            basePath={dashboardRoutes.orders}
            count={result.orders.count}
            page={listParams.page}
            pageSize={result.orders.limit}
            searchParams={resolvedSearchParams}
          />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Orders could not be loaded</AlertTitle>
          <AlertDescription>{result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
