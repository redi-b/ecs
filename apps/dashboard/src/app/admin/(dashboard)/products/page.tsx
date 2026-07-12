import { headers } from "next/headers";
import { ListSetupState } from "@/components/app/list-error-state";
import { ListSummary, PaginationControls } from "@/components/app/list-page-controls";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MessageKey } from "@/i18n/messages";
import { getRequestMessages } from "@/i18n/server";
import { ProductCreateDialog } from "@/features/products/product-create-dialog";
import {
  parseProductMediaFilter,
  parseProductStatusFilter,
  parseProductStockFilter,
  parseProductVariantCountFilter,
} from "@/features/products/product-table-state";
import { ProductsTable } from "@/features/products/products-table";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
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
  const { messages } = await getRequestMessages();
  const t = (key: MessageKey) => messages[key];
  const requestHeaders = await headers();
  const cookieHeader = requestHeaders.get("cookie");
  const requestHost = requestHeaders.get("host");
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const offset = (listParams.page - 1) * listParams.pageSize;
  const productNotice = getProductNotice(resolvedSearchParams.productStatus, t);
  const statusFilter = parseProductStatusFilter(listParams.status);
  const collectionFilter = getResourceFilter(resolvedSearchParams.collectionId);
  const categoryFilter = getResourceFilter(resolvedSearchParams.categoryId);
  // Taxonomy (categories/collections) loads client-side after paint — keeps list TTFB
  // on the product page only.
  const result = await getMerchantProducts({
    cookieHeader,
    limit: listParams.pageSize,
    offset,
    platformApiBaseUrl,
    requestHost,
    tenantId,
    ...(listParams.q ? { q: listParams.q } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    ...(collectionFilter !== "all" ? { collectionId: collectionFilter } : {}),
    ...(categoryFilter !== "all" ? { categoryId: categoryFilter } : {}),
  });
  const errorState = result.ok ? null : getListErrorState("products", result.message);

  return (
    <PageShell
      actions={
        <>
          <RefreshButton />
          <ProductCreateDialog
            action={getTenantScopedPath(dashboardRoutes.productCreateAction, tenantId)}
            tenantId={tenantId}
          />
        </>
      }
      description={t("products.description")}
      title={t("products.title")}
    >
      {productNotice ? (
        <Alert variant={productNotice.variant}>
          <AlertTitle>{productNotice.title}</AlertTitle>
          <AlertDescription>{productNotice.description}</AlertDescription>
        </Alert>
      ) : null}
      {result.ok ? (
        <>
          <ListSummary count={result.products.count} label={t("nav.products").toLowerCase()} />
          <ProductsTable
            footer={
              <PaginationControls
                basePath={dashboardRoutes.products}
                count={result.products.count}
                page={listParams.page}
                pageSize={result.products.limit}
                searchParams={resolvedSearchParams}
              />
            }
            initialCategoryId={categoryFilter}
            initialCollectionId={collectionFilter}
            initialMedia={parseProductMediaFilter(resolvedSearchParams.media)}
            initialQuery={listParams.q}
            initialStatus={statusFilter}
            initialStock={parseProductStockFilter(resolvedSearchParams.stock)}
            initialVariantCount={parseProductVariantCountFilter(resolvedSearchParams.variantCount)}
            pageSize={result.products.limit}
            products={result.products.products}
            tenantId={tenantId}
            totalCount={result.products.count}
          />
        </>
      ) : errorState?.kind === "setup" || errorState?.kind === "service" ? (
        <ListSetupState state={errorState} />
      ) : (
        <Alert variant="destructive">
          <AlertTitle>{errorState?.title ?? t("products.error.loadTitle")}</AlertTitle>
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

function getProductNotice(
  productStatus: string | string[] | undefined,
  t: (key: MessageKey) => string,
) {
  const status = Array.isArray(productStatus) ? productStatus[0] : productStatus;

  if (!status) {
    return null;
  }

  if (status === "product_created") {
    return {
      variant: "default" as const,
      title: t("products.notice.created.title"),
      description: t("products.notice.created.description"),
    };
  }

  if (status === "product_updated") {
    return {
      variant: "default" as const,
      title: t("products.notice.updated.title"),
      description: t("products.notice.updated.description"),
    };
  }

  const mutationError = getListErrorState("products", status);

  if (mutationError.kind === "setup" || mutationError.kind === "service") {
    return null;
  }

  return {
    variant: "destructive" as const,
    title: t("products.notice.error.title"),
    description: mutationError.description,
  };
}
