import { SavedProductOptionsManager } from "@/features/products/saved-product-options-manager";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";

export default async function SavedProductOptionsPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  return <SavedProductOptionsManager tenantId={tenantId ?? null} />;
}
