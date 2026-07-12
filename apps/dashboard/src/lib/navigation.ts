import type { AppIcon } from "@/components/app/icons";
import { AppIcons } from "@/components/app/icons";
import { type DashboardRouteHref, dashboardRoutes } from "@/lib/routes";

export type AppRouteSection = "main" | "commerce" | "storefront" | "insights" | "footer";

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

/**
 * Primary scrollable sections. Footer routes (settings, billing) render in the sticky bottom.
 */
export const appRouteSections: ReadonlyArray<{ id: AppRouteSection; label: string | null }> = [
  { id: "main", label: null },
  { id: "commerce", label: "Commerce" },
  { id: "storefront", label: "Storefront" },
  { id: "insights", label: "Insights" },
];

export const appRoutes: AppRoute[] = [
  {
    id: "overview",
    title: "Overview",
    href: dashboardRoutes.overview,
    icon: AppIcons.home,
    section: "main",
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
        title: "All products",
        href: dashboardRoutes.products,
        icon: AppIcons.products,
        section: "commerce",
        keywords: ["catalog", "items", "inventory"],
      },
      {
        id: "product-categories",
        title: "Categories",
        href: dashboardRoutes.productCategories,
        icon: AppIcons.tree,
        section: "commerce",
        keywords: ["catalog", "taxonomy", "categories"],
      },
      {
        id: "product-collections",
        title: "Collections",
        href: dashboardRoutes.productCollections,
        icon: AppIcons.folder,
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
    id: "customers",
    title: "Customers",
    href: dashboardRoutes.customers,
    icon: AppIcons.user,
    section: "commerce",
    keywords: ["people", "buyers", "groups", "contacts"],
  },
  {
    id: "promotions",
    title: "Promotions",
    href: dashboardRoutes.promotions,
    icon: AppIcons.tag,
    section: "commerce",
    keywords: ["discounts", "coupons", "codes", "campaigns"],
  },
  {
    id: "media",
    title: "Media",
    href: dashboardRoutes.media,
    icon: AppIcons.image,
    section: "commerce",
    keywords: ["images", "files", "uploads", "library"],
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
    section: "insights",
    keywords: ["analytics", "reports", "sales"],
  },
  {
    id: "billing",
    title: "Billing",
    href: dashboardRoutes.billing,
    icon: AppIcons.billing,
    section: "footer",
    keywords: ["plan", "subscription", "payments"],
  },
  {
    id: "settings",
    title: "Settings",
    href: dashboardRoutes.settings,
    icon: AppIcons.settings,
    section: "footer",
    keywords: ["shop", "account", "preferences"],
  },
];

export function getAppRoutesBySection(section: AppRouteSection) {
  return appRoutes.filter((route) => route.section === section);
}

export function getFooterAppRoutes() {
  return getAppRoutesBySection("footer");
}

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
