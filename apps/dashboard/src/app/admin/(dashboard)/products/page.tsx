import { headers } from "next/headers";

import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductCreateDialog } from "@/features/products/product-create-dialog";
import { ProductsTable } from "@/features/products/products-table";
import {
  parseProductMediaFilter,
  parseProductStatusFilter,
  parseProductStockFilter,
  parseProductVariantCountFilter,
} from "@/features/products/product-table-state";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getListErrorState, type ListErrorState } from "@/lib/list-error-state";
import {
  getMerchantProductCategories,
  getMerchantProductCollections,
  getMerchantProducts,
} from "@/lib/merchant-products";
import { dashboardRoutes } from "@/lib/routes";
import { parseListSearchParams } from "@/lib/url-state";

type MerchantProductsPageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

type ReferenceDataError = {
  label: string;
  state: ListErrorState;
};

export default async function MerchantProductsPage({ searchParams }: MerchantProductsPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const listParams = parseListSearchParams(resolvedSearchParams);
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie");
  const requestHost = requestHeaders.get("host");
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const offset = (listParams.page - 1) * listParams.pageSize;
  const productNotice = getProductNotice(resolvedSearchParams.productStatus);
  const [result, categoriesResult, collectionsResult] = await Promise.all([
    getMerchantProducts({
      cookieHeader,
      limit: listParams.pageSize,
      offset,
      platformApiBaseUrl,
      requestHost,
      tenantId,
    }),
    getMerchantProductCategories({
      cookieHeader,
      limit: 100,
      offset: 0,
      platformApiBaseUrl,
      requestHost,
      tenantId,
    }),
    getMerchantProductCollections({
      cookieHeader,
      limit: 100,
      offset: 0,
      platformApiBaseUrl,
      requestHost,
      tenantId,
    }),
  ]);
  const referenceDataErrors = [
    getReferenceDataError("Categories", categoriesResult),
    getReferenceDataError("Collections", collectionsResult),
  ].filter((error): error is ReferenceDataError => Boolean(error));
  const setupError = referenceDataErrors.find(
    (error) => error.state.kind === "setup" || error.state.kind === "service",
  );
  const optionErrors = referenceDataErrors.filter((error) => error.state.kind === "error");
  const errorState = result.ok ? null : getListErrorState("products", result.message);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <ProductCreateDialog
            action={getTenantScopedPath(dashboardRoutes.productCreateAction, tenantId)}
            categories={categoriesResult.ok ? categoriesResult.categories : []}
            collections={collectionsResult.ok ? collectionsResult.collections : []}
            disabledReason={setupError?.state.description}
            optionErrorLabels={optionErrors.map((error) => error.label.toLowerCase())}
          />
        </>
      }
      description="Create, review, and manage merchant-scoped catalog products."
      title="Products"
    >
      {productNotice ? (
        <Alert variant={productNotice.variant}>
          <AlertTitle>{productNotice.title}</AlertTitle>
          <AlertDescription>{productNotice.description}</AlertDescription>
        </Alert>
      ) : null}
      {result.ok ? (
        <>
          <ListSummary count={result.products.count} label="products" />
          <ProductsTable
            categories={categoriesResult.ok ? categoriesResult.categories : []}
            collections={collectionsResult.ok ? collectionsResult.collections : []}
            initialCategoryId={getResourceFilter(resolvedSearchParams.categoryId)}
            initialCollectionId={getResourceFilter(resolvedSearchParams.collectionId)}
            initialMedia={parseProductMediaFilter(resolvedSearchParams.media)}
            initialQuery={listParams.q}
            initialStatus={parseProductStatusFilter(listParams.status)}
            initialStock={parseProductStockFilter(resolvedSearchParams.stock)}
            initialVariantCount={parseProductVariantCountFilter(resolvedSearchParams.variantCount)}
            pageSize={result.products.limit}
            products={result.products.products}
            tenantId={tenantId}
            totalCount={result.products.count}
          />
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

function getResourceFilter(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const trimmed = candidate?.trim();

  return trimmed || "all";
}

function getReferenceDataError(
  label: string,
  result:
    | Awaited<ReturnType<typeof getMerchantProductCategories>>
    | Awaited<ReturnType<typeof getMerchantProductCollections>>,
): ReferenceDataError | null {
  if (result.ok) {
    return null;
  }

  return {
    label,
    state: getListErrorState("products", result.message),
  };
}

function getProductNotice(productStatus: string | string[] | undefined) {
  const status = Array.isArray(productStatus) ? productStatus[0] : productStatus;

  if (!status) {
    return null;
  }

  if (status === "product_created") {
    return {
      variant: "default" as const,
      title: "Product created",
      description: "The product was created and is now available in this merchant catalog.",
    };
  }

  if (status === "product_updated") {
    return {
      variant: "default" as const,
      title: "Product updated",
      description: "The product changes were saved and the catalog list has been refreshed.",
    };
  }

  const mutationError = getListErrorState("products", status);

  if (mutationError.kind === "setup" || mutationError.kind === "service") {
    return null;
  }

  return {
    variant: "destructive" as const,
    title: "Product could not be saved",
    description: mutationError.description,
  };
}
