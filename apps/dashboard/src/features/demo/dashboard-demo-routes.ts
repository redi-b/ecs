import type { AppRoute } from "@/lib/navigation";

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
