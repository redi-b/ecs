export const dashboardRoutes = {
  overview: "/admin",
  products: "/admin/products",
  productsNew: "/admin/products/new",
  productDetail: (productId: string) => `/admin/products/${encodeURIComponent(productId)}`,
  orders: "/admin/orders",
  editor: "/admin/editor",
  insights: "/admin/insights",
  billing: "/admin/billing",
  settings: "/admin/settings",
} as const;

export type DashboardRouteHref = Extract<(typeof dashboardRoutes)[keyof typeof dashboardRoutes], string>;
