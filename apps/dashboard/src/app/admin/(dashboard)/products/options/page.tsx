import { PageShell } from "@/components/app/page-shell";
import { SavedProductOptionsManager } from "@/features/products/saved-product-options-manager";
import { getTranslations } from "@/i18n/server";
import { type DashboardSearchParams, getSelectedTenantId } from "@/lib/dashboard-tenant-context";

export default async function SavedProductOptionsPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);
  const t = await getTranslations();

  return (
    <PageShell
      description={t("products.savedOptions.pageDescription")}
      title={t("products.savedOptions.pageTitle")}
    >
      <SavedProductOptionsManager tenantId={tenantId ?? null} />
    </PageShell>
  );
}
