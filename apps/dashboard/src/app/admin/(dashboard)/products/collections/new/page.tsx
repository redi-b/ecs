import { PageShell } from "@/components/app/page-shell";
import { TaxonomyForm } from "@/features/catalog-taxonomy/taxonomy-form";
import { getRequestMessages } from "@/i18n/server";
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
  const { messages } = await getRequestMessages();
  const t = (key: any) => messages[key as keyof typeof messages];

  return (
    <PageShell
      description={t("collections.create.shellDescription" as any)}
      title={t("collections.create.shellTitle" as any)}
    >
      <TaxonomyForm
        action={getTenantScopedPath(dashboardRoutes.productCollectionCreateAction, tenantId)}
        entityLabel="collection"
        name="title"
        nameLabel={t("common.title" as any) ?? "Title"}
        namePlaceholder="Summer essentials"
        submitLabel={t("collections.create.submitLabel" as any)}
      />
    </PageShell>
  );
}
