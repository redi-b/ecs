import { cookies, headers } from "next/headers";

import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { RefreshButton } from "@/components/app/refresh-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductDetail } from "@/features/products/product-detail";
import { ProductForm } from "@/features/products/product-form";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getListErrorState, type ListErrorState } from "@/lib/list-error-state";
import {
  getMerchantProduct,
  getMerchantProductCategories,
  getMerchantProductCollections,
} from "@/lib/merchant-products";
import { dashboardRoutes } from "@/lib/routes";

type MerchantProductDetailPageProps = {
  params: Promise<{ productId: string }>;
  searchParams?: Promise<DashboardSearchParams>;
};

type ReferenceDataError = {
  label: string;
  state: ListErrorState;
};

export default async function MerchantProductDetailPage({
  params,
  searchParams,
}: MerchantProductDetailPageProps) {
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
  const [productResult, categoriesResult, collectionsResult] = await Promise.all([
    getMerchantProduct({
      ...requestOptions,
      productId,
    }),
    getMerchantProductCategories({
      ...requestOptions,
      limit: 100,
      offset: 0,
    }),
    getMerchantProductCollections({
      ...requestOptions,
      limit: 100,
      offset: 0,
    }),
  ]);
  const productErrorState = productResult.ok
    ? null
    : getListErrorState("products", productResult.message);
  const referenceDataErrors = [
    getReferenceDataError("Categories", categoriesResult),
    getReferenceDataError("Collections", collectionsResult),
  ].filter((error): error is ReferenceDataError => Boolean(error));
  const setupError =
    productErrorState?.kind === "setup" || productErrorState?.kind === "service"
      ? productErrorState
      : referenceDataErrors.find(
          (error) => error.state.kind === "setup" || error.state.kind === "service",
        )?.state;
  const optionErrors = referenceDataErrors.filter((error) => error.state.kind === "error");

  return (
    <PageShell
      actions={<RefreshButton />}
      description="Review merchant-scoped product details and update storefront product data."
      title="Product details"
    >
      {setupError ? (
        <ListSetupState state={setupError} />
      ) : productResult.ok ? (
        <>
          <DashboardBreadcrumbLabel
            id="product-details"
            label={productResult.product.title ?? productResult.product.handle ?? null}
          />
          {optionErrors.length ? <ReferenceDataAlert errors={optionErrors} /> : null}
          <ProductDetail
            categories={categoriesResult.ok ? categoriesResult.categories : []}
            collections={collectionsResult.ok ? collectionsResult.collections : []}
            product={productResult.product}
            tenantId={tenantId}
          />
          {optionErrors.length ? null : (
            <ProductForm
              action={getTenantScopedPath(
                dashboardRoutes.productUpdateAction(productResult.product.id),
                tenantId,
              )}
              categories={categoriesResult.ok ? categoriesResult.categories : []}
              collections={collectionsResult.ok ? collectionsResult.collections : []}
              product={productResult.product}
              submitLabel="Save product"
            />
          )}
        </>
      ) : (
        <ProductLoadAlert state={productErrorState} />
      )}
    </PageShell>
  );
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

function ReferenceDataAlert({ errors }: { errors: ReferenceDataError[] }) {
  const labels = errors.map((error) => error.label.toLowerCase()).join(" and ");

  return (
    <Alert variant="destructive">
      <AlertTitle>Product options could not be loaded</AlertTitle>
      <AlertDescription>
        {`Could not load ${labels}. Editing is disabled until reference data loads to avoid clearing existing relationships.`}
      </AlertDescription>
    </Alert>
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
