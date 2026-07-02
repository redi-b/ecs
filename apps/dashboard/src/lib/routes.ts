export const dashboardRoutes = {
  overview: "/admin",
  products: "/admin/products",
  orders: "/admin/orders",
  editor: "/admin/editor",
  insights: "/admin/insights",
  billing: "/admin/billing",
  settings: "/admin/settings",
} as const;

export type DashboardRouteHref =
  (typeof dashboardRoutes)[keyof typeof dashboardRoutes];
