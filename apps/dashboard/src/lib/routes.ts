export const dashboardRoutes = {
  overview: "/admin",
  products: "/admin/products",
  productCreateAction: "/admin/products/actions/create",
  productListAction: "/admin/products/actions/list",
  productCategories: "/admin/products/categories",
  productCategoriesNew: "/admin/products/categories/new",
  productCategoryCreateAction: "/admin/product-categories/actions/create",
  productCollections: "/admin/products/collections",
  productCollectionsNew: "/admin/products/collections/new",
  productCollectionCreateAction: "/admin/product-collections/actions/create",
  productDetail: (productId: string) => `/admin/products/${encodeURIComponent(productId)}`,
  productEdit: (productId: string) => `/admin/products/${encodeURIComponent(productId)}/edit`,
  productStockAction: (productId: string) =>
    `/admin/products/actions/${encodeURIComponent(productId)}/stock`,
  productVariantStockAction: (productId: string, variantId: string) =>
    `/admin/products/actions/${encodeURIComponent(productId)}/variants/${encodeURIComponent(
      variantId,
    )}/stock`,
  productUpdateAction: (productId: string) =>
    `/admin/products/actions/${encodeURIComponent(productId)}`,
  productDeleteAction: (productId: string) =>
    `/admin/products/actions/${encodeURIComponent(productId)}/delete`,
  productsBatchDeleteAction: "/admin/products/actions/batch-delete",
  productCategoryDeleteAction: (categoryId: string) =>
    `/admin/products/categories/actions/${encodeURIComponent(categoryId)}/delete`,
  productCategoryUpdateAction: (categoryId: string) =>
    `/admin/products/categories/actions/${encodeURIComponent(categoryId)}`,
  productCategoriesReorderAction: "/admin/products/categories/actions/reorder",
  productCategoriesBatchDeleteAction: "/admin/products/categories/actions/batch-delete",
  productCollectionDeleteAction: (collectionId: string) =>
    `/admin/products/collections/actions/${encodeURIComponent(collectionId)}/delete`,
  productCollectionUpdateAction: (collectionId: string) =>
    `/admin/products/collections/actions/${encodeURIComponent(collectionId)}`,
  productCollectionProductsAction: (collectionId: string) =>
    `/admin/products/collections/actions/${encodeURIComponent(collectionId)}/products`,
  productCollectionsBatchDeleteAction: "/admin/products/collections/actions/batch-delete",
  orders: "/admin/orders",
  media: "/admin/media",
  customers: "/admin/customers",
  promotions: "/admin/promotions",
  customerDetail: (customerId: string) => `/admin/customers/${encodeURIComponent(customerId)}`,
  orderAction: (orderId: string) => `/admin/orders/actions/${encodeURIComponent(orderId)}`,
  orderDetail: (orderId: string) => `/admin/orders/${encodeURIComponent(orderId)}`,
  editor: "/admin/editor",
  insights: "/admin/insights",
  billing: "/admin/billing",
  settings: "/admin/settings",
  storefrontTemplate: "/admin/storefront/template",
} as const;

export type DashboardRouteHref = Extract<
  (typeof dashboardRoutes)[keyof typeof dashboardRoutes],
  string
>;
