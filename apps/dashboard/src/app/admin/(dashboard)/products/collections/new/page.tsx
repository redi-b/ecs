import { PageShell } from "@/components/app/page-shell";
import { TaxonomyForm } from "@/features/catalog-taxonomy/taxonomy-form";
import {
  type DashboardSearchParams,
  getSelectedTenantId,
  getTenantScopedPath,
} from "@/lib/dashboard-tenant-context";
import { dashboardRoutes } from "@/lib/routes";

type MerchantProductCollectionCreatePageProps = {
  searchParams?: Promise<DashboardSearchParams>;
};

export default async function MerchantProductCollectionCreatePage({
  searchParams,
}: MerchantProductCollectionCreatePageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const tenantId = getSelectedTenantId(resolvedSearchParams);

  return (
    <PageShell
      description="Create a product collection for grouping related catalog items and campaign merchandising."
      title="New collection"
    >
      <TaxonomyForm
        action={getTenantScopedPath(dashboardRoutes.productCollectionCreateAction, tenantId)}
        entityLabel="collection"
        name="title"
        nameLabel="Title"
        namePlaceholder="Summer essentials"
        submitLabel="Create collection"
      />
    </PageShell>
  );
}
