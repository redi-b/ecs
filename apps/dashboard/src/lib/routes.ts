export const dashboardRoutes = {
  overview: "/admin",
  products: "/admin/products",
  productsNew: "/admin/products/new",
  productCreateAction: "/admin/products/actions/create",
  productCategories: "/admin/products/categories",
  productCategoriesNew: "/admin/products/categories/new",
  productCategoryCreateAction: "/admin/product-categories/actions/create",
  productCollections: "/admin/products/collections",
  productCollectionsNew: "/admin/products/collections/new",
  productCollectionCreateAction: "/admin/product-collections/actions/create",
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
