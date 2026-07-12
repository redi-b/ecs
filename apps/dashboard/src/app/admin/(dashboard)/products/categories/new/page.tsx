import { PageShell } from "@/components/app/page-shell";
import { TaxonomyForm } from "@/features/catalog-taxonomy/taxonomy-form";
import { getRequestMessages } from "@/i18n/server";
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
  const { messages } = await getRequestMessages();
  const t = (key: any) => messages[key as keyof typeof messages];

  return (
    <PageShell
      description={t("categories.create.shellDescription" as any)}
      title={t("categories.create.shellTitle" as any)}
    >
      <TaxonomyForm
        action={getTenantScopedPath(dashboardRoutes.productCategoryCreateAction, tenantId)}
        entityLabel="category"
        name="name"
        nameLabel={t("onboarding.categoryFieldName" as any) ?? "Name"}
        namePlaceholder="Coffee beans"
        submitLabel={t("categories.create.submitLabel" as any)}
      />
    </PageShell>
  );
}
