import type { AppIcon } from "@/components/app/icons";
import { AppIcons } from "@/components/app/icons";
import { dashboardRoutes, type DashboardRouteHref } from "@/lib/routes";

export type AppRouteSection =
  | "commerce"
  | "storefront"
  | "business"
  | "system";

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

export function findRouteByHref(pathname: string) {
  return appRoutes.find((route) => route.href === pathname);
}
