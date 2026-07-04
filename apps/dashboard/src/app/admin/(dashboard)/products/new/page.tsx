import { cookies, headers } from "next/headers";

import { ListSetupState } from "@/components/app/list-error-state";
import { PageShell } from "@/components/app/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ProductForm } from "@/features/products/product-form";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { getListErrorState, type ListErrorState } from "@/lib/list-error-state";
import {
  getMerchantProductCategories,
  getMerchantProductCollections,
} from "@/lib/merchant-products";

type MerchantProductCreatePageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

type ReferenceDataError = {
  label: string;
  state: ListErrorState;
};

export default async function MerchantProductCreatePage({
  searchParams,
}: MerchantProductCreatePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const platformApiBaseUrl = process.env.PLATFORM_API_BASE_URL ?? "http://localhost:3000";
  const referenceDataOptions = {
    cookieHeader: cookieStore.toString(),
    limit: 100,
    offset: 0,
    platformApiBaseUrl,
    requestHost: requestHeaders.get("host"),
    tenantId,
  };
  const [categoriesResult, collectionsResult] = await Promise.all([
    getMerchantProductCategories(referenceDataOptions),
    getMerchantProductCollections(referenceDataOptions),
  ]);
  const referenceDataErrors = [
    getReferenceDataError("Categories", categoriesResult),
    getReferenceDataError("Collections", collectionsResult),
  ].filter((error): error is ReferenceDataError => Boolean(error));
  const setupError = referenceDataErrors.find(
    (error) => error.state.kind === "setup" || error.state.kind === "service",
  );
  const optionErrors = referenceDataErrors.filter((error) => error.state.kind === "error");
  const categories = categoriesResult.ok ? categoriesResult.categories : [];
  const collections = collectionsResult.ok ? collectionsResult.collections : [];
  const action = getTenantScopedPath("/admin/products/create", tenantId);

  return (
    <PageShell
      description="Create a merchant catalog item and publish it when the product data is ready."
      title="Create product"
    >
      {setupError ? (
        <ListSetupState state={setupError.state} />
      ) : (
        <>
          {optionErrors.length ? <ReferenceDataAlert errors={optionErrors} /> : null}
          <ProductForm
            action={action}
            categories={categories}
            collections={collections}
            submitLabel="Create product"
          />
        </>
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
        {`Could not load ${labels}. You can still create a basic product and add options later.`}
      </AlertDescription>
    </Alert>
  );
}
