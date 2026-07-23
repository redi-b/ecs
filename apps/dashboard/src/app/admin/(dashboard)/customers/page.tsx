import { headers } from "next/headers";

import { ListSetupState } from "@/components/app/list-error-state";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog";
import { CustomersTable } from "@/features/customers/customers-table";
import { getTranslations } from "@/i18n/server";
import type { DashboardSearchParams } from "@/lib/dashboard-tenant-context";
import { getListErrorState } from "@/lib/list-error-state";
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
  const t = await getTranslations();
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
  const errorState = result.ok ? null : getListErrorState("customers", result.message);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <CustomerFormDialog />
        </>
      }
      description={t("customers.description")}
      title={t("customers.title")}
    >
      {result.ok ? (
        <>
          <ListSummary
            count={result.customers.count}
            filtered={Boolean(listParams.q)}
            page={listParams.page}
            pageSize={result.customers.limit}
          />
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
            initialQuery={listParams.q}
            {...(highlightCustomerId ? { highlightCustomerId } : {})}
            totalCount={result.customers.count}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? t("customers.error.loadTitle")}</AlertTitle>
          <AlertDescription>
            {errorState?.description ?? t("customers.error.loadDescription")}
          </AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
