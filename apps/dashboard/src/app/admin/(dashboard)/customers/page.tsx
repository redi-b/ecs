import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { CustomersTable } from "@/features/customers/customers-table";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getMerchantCustomers } from "@/lib/merchant-customers";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type CustomersPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const highlightRaw = resolvedSearchParams.highlight;
  const highlightCustomerId = Array.isArray(highlightRaw)
    ? highlightRaw[0]
    : highlightRaw;
  const offset = (listParams.page - 1) * listParams.pageSize;
  const requestHeaders = await headers();
  const result = await getMerchantCustomers({
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
          <CustomerFormDialog />
        </>
      }
      description="Understand buyers, maintain contact details, and support repeat customers."
      title="Customers"
    >
      {result.ok ? (
        <>
          <ListSummary count={result.customers.count} label="customers" />
          <CustomersTable
            customers={result.customers.customers}
            footer={
              <PaginationControls
                basePath={dashboardRoutes.customers}
                count={result.customers.count}
                page={listParams.page}
                pageSize={result.customers.limit}
                searchParams={resolvedSearchParams}
              />
            }
            {...(highlightCustomerId ? { highlightCustomerId } : {})}
            totalCount={result.customers.count}
          />
        </>
      ) : (
        <Alert variant="destructive">
          <AlertTitle>Customers could not be loaded</AlertTitle>
          <AlertDescription>
            The customers list is temporarily unavailable. Refresh and try again.
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
