import { headers } from "next/headers";
import { ListSetupState } from "@/components/app/list-error-state";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ManualOrderCreateDialog } from "@/features/orders/manual-order-create-dialog";
import {
  parseOrderDateFilter,
  parseOrderDeliveryFilter,
  parseOrderFulfillmentFilter,
  parseOrderLifecycleFilter,
  parseOrderPaymentFilter,
} from "@/features/orders/order-table-state";
import { OrdersTable } from "@/features/orders/orders-table";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getListErrorState } from "@/lib/list-error-state";
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
  const errorState = result.ok ? null : getListErrorState("orders", result.message);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <ManualOrderCreateDialog />
        </>
      }
      description="Review orders, payment status, and fulfillment progress. Create COD orders for phone or in-person sales."
      title="Orders"
    >
      {result.ok ? (
        <>
          <ListSummary count={result.orders.count} label="orders" />
          <OrdersTable
            footer={
              <PaginationControls
                basePath={dashboardRoutes.orders}
                count={result.orders.count}
                page={listParams.page}
                pageSize={result.orders.limit}
                searchParams={resolvedSearchParams}
              />
            }
            initialCreated={parseOrderDateFilter(resolvedSearchParams.created)}
            initialDelivery={parseOrderDeliveryFilter(resolvedSearchParams.delivery)}
            initialFulfillment={parseOrderFulfillmentFilter(resolvedSearchParams.fulfillment)}
            initialLifecycle={parseOrderLifecycleFilter(resolvedSearchParams.lifecycle)}
            initialPayment={parseOrderPaymentFilter(resolvedSearchParams.payment)}
            initialQuery={listParams.q}
            orders={result.orders.orders}
            pageSize={result.orders.limit}
            tenantId={tenantId}
            totalCount={result.orders.count}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? "Orders could not be loaded"}</AlertTitle>
          <AlertDescription>{errorState?.description ?? result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
