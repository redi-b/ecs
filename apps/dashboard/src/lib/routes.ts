export const dashboardRoutes = {
  overview: "/",
  products: "/products",
  orders: "/orders",
  editor: "/editor",
  insights: "/insights",
  billing: "/billing",
  settings: "/settings",
} as const;

export type DashboardRouteHref =
  (typeof dashboardRoutes)[keyof typeof dashboardRoutes];
