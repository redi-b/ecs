import { PageShell } from "@/components/app/page-shell";
import { TaxonomyForm } from "@/features/catalog-taxonomy/taxonomy-form";
import { getTranslations } from "@/i18n/server";
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
  const t = await getTranslations();

  return (
    <PageShell
      description={t("categories.create.shellDescription")}
      title={t("categories.create.shellTitle")}
    >
      <TaxonomyForm
        action={getTenantScopedPath(dashboardRoutes.productCategoryCreateAction, tenantId)}
        entityLabel="category"
        name="name"
        nameLabel={t("taxonomy.create.nameLabel")}
        namePlaceholder="Coffee beans"
        submitLabel={t("categories.create.submitLabel")}
      />
    </PageShell>
  );
}
