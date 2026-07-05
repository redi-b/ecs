export const dashboardRoutes = {
  overview: "/admin",
  products: "/admin/products",
  productsNew: "/admin/products/new",
  productCreateAction: "/admin/products/actions/create",
  productDetail: (productId: string) => `/admin/products/${encodeURIComponent(productId)}`,
  productUpdateAction: (productId: string) =>
    `/admin/products/actions/${encodeURIComponent(productId)}`,
  orders: "/admin/orders",
  orderDetail: (orderId: string) => `/admin/orders/${encodeURIComponent(orderId)}`,
  editor: "/admin/editor",
  insights: "/admin/insights",
  billing: "/admin/billing",
  settings: "/admin/settings",
} as const;

export type DashboardRouteHref = Extract<(typeof dashboardRoutes)[keyof typeof dashboardRoutes], string>;
