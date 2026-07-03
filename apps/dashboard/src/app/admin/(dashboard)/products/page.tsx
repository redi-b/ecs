import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductsTable } from "@/features/products/products-table";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";
import { getListErrorState } from "@/lib/list-error-state";
import { getMerchantProducts } from "@/lib/merchant-products";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type MerchantProductsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductsPage({ searchParams }: MerchantProductsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const offset = (listParams.page - 1) * listParams.pageSize;
  const result = await getMerchantProducts({
    cookieHeader: requestHeaders.get("cookie"),
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl: process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000",
    requestHost: requestHeaders.get("host"),
    tenantId,
  });
  const errorState = result.ok ? null : getListErrorState("products", result.message);

  return (
    <PageShell
      description="Review merchant-scoped catalog data from the Platform API. Product creation and editing controls will build on this list foundation."
      title="Products"
    >
      {result.ok ? (
        <>
          <ListSummary count={result.products.count} label="products" />
          <ProductsTable products={result.products.products} />
          <PaginationControls
            basePath={dashboardRoutes.products}
            count={result.products.count}
            page={listParams.page}
            pageSize={result.products.limit}
            searchParams={resolvedSearchParams}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? "Products could not be loaded"}</AlertTitle>
          <AlertDescription>{errorState?.description ?? result.message}</AlertDescription>
        </Alert>
      )}
    </PageShell>
  );
}
