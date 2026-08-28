import { notFound } from "next/navigation";

import { DashboardBreadcrumbLabel } from "@/components/app/breadcrumb-labels";
import { PageShell } from "@/components/app/page-shell";
import { demoProducts } from "@/features/demo/dashboard-demo-sections";
import { DemoActionButton } from "@/features/demo/demo-action-button";
import { ProductDetail } from "@/features/products/product-detail";
import { getTranslations } from "@/i18n/server";

export default async function Page({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  const product = demoProducts.find((item) => item.id === productId);
  if (!product) notFound();
  const t = await getTranslations();

  return (
    <PageShell
      actions={<DemoActionButton size="sm">{t("common.edit")}</DemoActionButton>}
      description={t("products.detail.shellDescription")}
      title={product.title ?? t("products.detail.shellTitle")}
    >
      <DashboardBreadcrumbLabel label={product.title} labelKey="product-details" />
      <ProductDetail action="" product={product} readOnly />
    </PageShell>
  );
}
