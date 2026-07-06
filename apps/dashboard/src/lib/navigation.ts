import type { AppIcon } from "@/components/app/icons";
import { AppIcons } from "@/components/app/icons";
import { type DashboardRouteHref, dashboardRoutes } from "@/lib/routes";

export type AppRouteSection = "commerce" | "storefront" | "business" | "system";

export type AppRoute = {
  id: string;
  title: string;
  href: DashboardRouteHref;
  icon: AppIcon;
  section: AppRouteSection;
  keywords: string[];
  children?: AppRoute[];
  disabled?: boolean;
};

export const appRoutes: AppRoute[] = [
  {
    id: "overview",
    title: "Overview",
    href: dashboardRoutes.overview,
    icon: AppIcons.home,
    section: "business",
    keywords: ["home", "dashboard", "summary"],
  },
  {
    id: "products",
    title: "Products",
    href: dashboardRoutes.products,
    icon: AppIcons.products,
    section: "commerce",
    keywords: ["catalog", "items", "inventory", "collections", "categories"],
    children: [
      {
        id: "products-list",
        title: "Products",
        href: dashboardRoutes.products,
        icon: AppIcons.products,
        section: "commerce",
        keywords: ["catalog", "items", "inventory"],
      },
      {
        id: "product-categories",
        title: "Categories",
        href: dashboardRoutes.productCategories,
        icon: AppIcons.products,
        section: "commerce",
        keywords: ["catalog", "taxonomy", "categories"],
      },
      {
        id: "product-collections",
        title: "Collections",
        href: dashboardRoutes.productCollections,
        icon: AppIcons.image,
        section: "commerce",
        keywords: ["catalog", "taxonomy", "collections"],
      },
    ],
  },
  {
    id: "orders",
    title: "Orders",
    href: dashboardRoutes.orders,
    icon: AppIcons.orders,
    section: "commerce",
    keywords: ["sales", "fulfillment", "customers"],
  },
  {
    id: "editor",
    title: "Editor",
    href: dashboardRoutes.editor,
    icon: AppIcons.editor,
    section: "storefront",
    keywords: ["storefront", "theme", "pages", "templates"],
  },
  {
    id: "insights",
    title: "Insights",
    href: dashboardRoutes.insights,
    icon: AppIcons.insights,
    section: "business",
    keywords: ["analytics", "reports", "sales"],
  },
  {
    id: "billing",
    title: "Billing",
    href: dashboardRoutes.billing,
    icon: AppIcons.billing,
    section: "business",
    keywords: ["plan", "subscription", "payments"],
  },
  {
    id: "settings",
    title: "Settings",
    href: dashboardRoutes.settings,
    icon: AppIcons.settings,
    section: "system",
    keywords: ["shop", "account", "preferences"],
  },
];

export function getNavigableAppRoutes() {
  const routes = new Map<DashboardRouteHref, AppRoute>();

  for (const route of appRoutes) {
    if (!routes.has(route.href)) {
      routes.set(route.href, route);
    }

    for (const child of route.children ?? []) {
      if (!routes.has(child.href)) {
        routes.set(child.href, child);
      }
    }
  }

  return [...routes.values()];
}

export function findRouteByHref(pathname: string) {
  return getNavigableAppRoutes().find((route) => route.href === pathname);
}
