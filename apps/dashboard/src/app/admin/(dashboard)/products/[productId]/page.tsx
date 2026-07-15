import { cookies, headers } from "next/headers";

import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductDeleteButton, ProductDetail } from "@/features/products/product-detail";
import { ProductStockPanel } from "@/features/products/product-stock-panel";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getListErrorState, type ListErrorState } from "@/lib/list-error-state";
import { getTranslations } from "@/i18n/server";
import { getMerchantProduct, getMerchantProductStock } from "@/lib/merchant-products";
import { dashboardRoutes } from "@/lib/routes";

type MerchantProductDetailPageProps = {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductDetailPage({
  params,
  searchParams,
}: MerchantProductDetailPageProps) {
  const t = await getTranslations();
  const [{ productId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const tenantId = getSelectedTenantId(resolvedSearchParams ?? {});
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const requestOptions = {
    cookieHeader: cookieStore.toString(),
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId,
  };
  // Product + stock only. Categories/collections resolve client-side for org labels
  // and the organization edit dialog (shared react-query cache with list page).
  const [productResult, stockResult] = await Promise.all([
    getMerchantProduct({
      ...requestOptions,
      productId,
    }),
    getMerchantProductStock({
      ...requestOptions,
      productId,
    }),
  ]);
  const productErrorState = productResult.ok
    ? null
    : getListErrorState("products", productResult.message);
  const setupError =
    productErrorState?.kind === "setup" || productErrorState?.kind === "service"
      ? productErrorState
      : null;

  return (
    <PageShell
      actions={
        <div className="flex items-center gap-2">
          {productResult.ok ? (
            <ProductDeleteButton
              productId={productResult.product.id}
              productTitle={productResult.product.title ?? "this product"}
              tenantId={tenantId}
            />
          ) : null}
          <RefreshButton />
        </div>
      }
      description={t("products.detail.shellDescription")}
      title={
        productResult.ok
          ? (productResult.product.title ?? t("products.detail.shellTitle"))
          : t("products.detail.shellTitle")
      }
    >
      {setupError ? (
        <ListSetupState state={setupError} />
      ) : productResult.ok ? (
        <>
          <DashboardBreadcrumbLabel
            label={productResult.product.title ?? productResult.product.handle ?? null}
            labelKey="product-details"
          />
          <ProductDetail
            action={getTenantScopedPath(
              dashboardRoutes.productUpdateAction(productResult.product.id),
              tenantId,
            )}
            product={productResult.product}
            tenantId={tenantId}
          />
          <ProductStockPanel
            action={getTenantScopedPath(
              dashboardRoutes.productStockAction(productResult.product.id),
              tenantId,
            )}
            initialStock={stockResult.ok ? stockResult.stock : undefined}
            product={productResult.product}
            productId={productResult.product.id}
            stockError={stockResult.ok ? undefined : stockResult.message}
            tenantId={tenantId}
          />
        </>
      ) : (
        <ProductLoadAlert state={productErrorState} />
      )}
    </PageShell>
  );
}

function ProductLoadAlert({ state }: { state: ListErrorState | null }) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Product could not be loaded</AlertTitle>
      <AlertDescription>{state?.description ?? "Try again later."}</AlertDescription>
    </Alert>
  );
}
