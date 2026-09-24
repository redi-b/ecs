import type { AppRoute } from "@/lib/navigation";
import { dashboardRoutes } from "@/lib/routes";

export const DEMO_ROUTE_HREFS: Readonly<Record<string, string>> = {
  overview: "/demo",
  products: "/demo/products",
  "products-list": "/demo/products",
  orders: "/demo/orders",
  editor: "/demo/editor",
  insights: "/demo/insights",
};

export function getDemoSidebarRoute(route: AppRoute): AppRoute {
  const href = DEMO_ROUTE_HREFS[route.id];
  const children = route.children?.map(getDemoSidebarRoute);
  const mappedRoute = {
    ...route,
    ...(children ? { children } : {}),
  };

  return href
    ? { ...mappedRoute, href: href as AppRoute["href"] }
    : { ...mappedRoute, disabled: true };
}

export function getDemoInsightsHref(report: string) {
  return report === "overview" ? "/demo/insights" : `/demo/insights/${report}`;
}

const DEMO_DASHBOARD_ROUTE_FAMILIES = [
  { dashboard: dashboardRoutes.products, demo: "/demo/products" },
  { dashboard: dashboardRoutes.orders, demo: "/demo/orders" },
  { dashboard: dashboardRoutes.editor, demo: "/demo/editor" },
  { dashboard: dashboardRoutes.insights, demo: "/demo/insights" },
] as const;

export function getDashboardPathFromDemo(pathname: string) {
  if (pathname === "/demo") return dashboardRoutes.overview;

  const family = DEMO_DASHBOARD_ROUTE_FAMILIES.find(
    ({ demo }) => pathname === demo || pathname.startsWith(`${demo}/`),
  );
  return family ? `${family.dashboard}${pathname.slice(family.demo.length)}` : null;
}

export function getDemoPathFromDashboard(pathname: string) {
  if (pathname === dashboardRoutes.overview) return "/demo";

  const family = DEMO_DASHBOARD_ROUTE_FAMILIES.find(
    ({ dashboard }) => pathname === dashboard || pathname.startsWith(`${dashboard}/`),
  );
  return family ? `${family.demo}${pathname.slice(family.dashboard.length)}` : "/demo";
}
