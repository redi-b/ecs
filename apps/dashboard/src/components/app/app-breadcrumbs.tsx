"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { useBreadcrumbLabels } from "@/components/app/breadcrumb-labels";
import Link from "@/components/app/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import type { MessageKey } from "@/i18n/messages";
import { useI18n } from "@/i18n/provider";
import { type DashboardBreadcrumb, getDashboardBreadcrumbTrail } from "@/lib/dashboard-breadcrumbs";
import { dashboardRoutes } from "@/lib/routes";

const BREADCRUMB_TITLE_KEYS: Record<string, MessageKey> = {
  overview: "nav.overview",
  products: "nav.products",
  "products-list": "nav.productsList",
  "product-categories": "nav.productCategories",
  "product-collections": "nav.productCollections",
  orders: "nav.orders",
  customers: "nav.customers",
  inquiries: "nav.inquiries",
  promotions: "nav.promotions",
  media: "nav.media",
  editor: "nav.editor",
  insights: "nav.insights",
  billing: "nav.billing",
  settings: "nav.settings",
  "product-categories-new": "nav.breadcrumbs.newCategory",
  "product-collections-new": "nav.breadcrumbs.newCollection",
  "product-details": "nav.breadcrumbs.productDetails",
  "product-edit": "nav.breadcrumbs.editProduct",
  "order-details": "nav.breadcrumbs.orderDetails",
  "customer-details": "nav.breadcrumbs.customerDetails",
};

function localizeBreadcrumbTitle(
  crumb: DashboardBreadcrumb,
  labels: ReturnType<typeof useBreadcrumbLabels>,
  t: (key: MessageKey) => string,
): string {
  const override = labels[crumb.id]?.trim();
  if (override) return override;

  const key = BREADCRUMB_TITLE_KEYS[crumb.id];
  if (key) return t(key);

  return crumb.title;
}

export function AppBreadcrumbs() {
  const pathname = usePathname();
  const demoPathname = getDemoDashboardPath(pathname);
  const { t } = useI18n();
  const labels = useBreadcrumbLabels();
  const trail = getDashboardBreadcrumbTrail(demoPathname ?? pathname, labels).map((crumb) => ({
    ...crumb,
    href: demoPathname ? getDemoHref(crumb.href) : crumb.href,
    title: localizeBreadcrumbTitle(crumb, labels, t),
  }));
  const currentRoute = trail.at(-1);

  if (!currentRoute || currentRoute.href === dashboardRoutes.overview || trail.length === 1) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{currentRoute?.title ?? t("nav.dashboard")}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap">
        {trail.slice(0, -1).map((route) => (
          <Fragment key={route.id}>
            <BreadcrumbItem className="hidden sm:inline-flex">
              <BreadcrumbLink asChild>
                <Link href={route.href}>{route.title}</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden sm:inline-flex" />
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage className="truncate">{currentRoute.title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function getDemoDashboardPath(pathname: string) {
  if (pathname === "/demo") return dashboardRoutes.overview;
  if (pathname.startsWith("/demo/products")) return dashboardRoutes.products;
  if (pathname.startsWith("/demo/orders")) return dashboardRoutes.orders;
  if (pathname.startsWith("/demo/storefront")) return dashboardRoutes.editor;
  if (pathname.startsWith("/demo/insights")) return dashboardRoutes.insights;
  return null;
}

function getDemoHref(href: string) {
  if (href === dashboardRoutes.overview) return "/demo";
  if (href.startsWith(dashboardRoutes.products)) return "/demo/products";
  if (href.startsWith(dashboardRoutes.orders)) return "/demo/orders";
  if (href.startsWith(dashboardRoutes.editor)) return "/demo/storefront";
  if (href.startsWith(dashboardRoutes.insights)) return "/demo/insights";
  return "/demo";
}
