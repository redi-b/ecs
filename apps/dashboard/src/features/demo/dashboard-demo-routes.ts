import type { AppRoute } from "@/lib/navigation";

export const DEMO_ROUTE_HREFS: Readonly<Record<string, string>> = {
  overview: "/demo",
  products: "/demo/products",
  orders: "/demo/orders",
  editor: "/demo/editor",
  insights: "/demo/insights",
};

export function getDemoSidebarRoute(route: AppRoute): AppRoute {
  const { children: _children, ...routeWithoutChildren } = route;
  const href = DEMO_ROUTE_HREFS[route.id];

  return href
    ? { ...routeWithoutChildren, href: href as AppRoute["href"] }
    : { ...routeWithoutChildren, disabled: true };
}

export function getDemoInsightsHref(report: string) {
  return report === "overview" ? "/demo/insights" : `/demo/insights/${report}`;
}
