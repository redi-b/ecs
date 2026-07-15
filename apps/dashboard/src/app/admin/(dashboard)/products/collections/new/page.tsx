import { PageShell } from "@/components/app/page-shell";
import { TaxonomyForm } from "@/features/catalog-taxonomy/taxonomy-form";
import { getTranslations } from "@/i18n/server";
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
  const t = await getTranslations();

  return (
    <PageShell
      description={t("collections.create.shellDescription")}
      title={t("collections.create.shellTitle")}
    >
      <TaxonomyForm
        action={getTenantScopedPath(dashboardRoutes.productCollectionCreateAction, tenantId)}
        entityLabel="collection"
        name="title"
        nameLabel={t("taxonomy.create.titleLabel")}
        namePlaceholder="Summer essentials"
        submitLabel={t("collections.create.submitLabel")}
      />
    </PageShell>
  );
}
