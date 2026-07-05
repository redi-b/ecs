import { PageShell } from "@/components/app/page-shell";
import { TaxonomyForm } from "@/features/catalog-taxonomy/taxonomy-form";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type MerchantProductCategoryCreatePageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductCategoryCreatePage({
  searchParams,
}: MerchantProductCategoryCreatePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);

  return (
    <PageShell
      description="Create a product category for organizing storefront catalog navigation and product assignment."
      title="New category"
    >
      <TaxonomyForm
        action={getTenantScopedPath(dashboardRoutes.productCategoryCreateAction, tenantId)}
        entityLabel="category"
        name="name"
        nameLabel="Name"
        namePlaceholder="Coffee beans"
        submitLabel="Create category"
      />
    </PageShell>
  );
}
