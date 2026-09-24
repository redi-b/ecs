export const dashboardRoutes = {
  overview: "/dashboard",
  products: "/dashboard/products",
  productCreateAction: "/dashboard/products/actions/create",
  productListAction: "/dashboard/products/actions/list",
  productsExportAction: "/dashboard/products/actions/export",
  productCategories: "/dashboard/products/categories",
  productCategoriesListAction: "/dashboard/products/categories/actions/list",
  productCategoriesNew: "/dashboard/products/categories/new",
  productCategoryCreateAction: "/dashboard/product-categories/actions/create",
  productCollections: "/dashboard/products/collections",
  productCollectionsListAction: "/dashboard/products/collections/actions/list",
  productCollectionsNew: "/dashboard/products/collections/new",
  productOptions: "/dashboard/products/options",
  productCollectionCreateAction: "/dashboard/product-collections/actions/create",
  productDetail: (productId: string) => `/dashboard/products/${encodeURIComponent(productId)}`,
  productEdit: (productId: string) => `/dashboard/products/${encodeURIComponent(productId)}/edit`,
  productStockAction: (productId: string) =>
    `/dashboard/products/actions/${encodeURIComponent(productId)}/stock`,
  productVariantStockAction: (productId: string, variantId: string) =>
    `/dashboard/products/actions/${encodeURIComponent(productId)}/variants/${encodeURIComponent(
      variantId,
    )}/stock`,
  productUpdateAction: (productId: string) =>
    `/dashboard/products/actions/${encodeURIComponent(productId)}`,
  productDeleteAction: (productId: string) =>
    `/dashboard/products/actions/${encodeURIComponent(productId)}/delete`,
  productsBatchDeleteAction: "/dashboard/products/actions/batch-delete",
  productsBatchInventoryAction: "/dashboard/products/actions/batch-inventory",
  productsImportDryRunAction: "/dashboard/products/actions/import-dry-run",
  productsImportApplyAction: "/dashboard/products/actions/import-apply",
  productImportExecutionAction: (executionId: string) =>
    `/dashboard/products/actions/import-executions/${encodeURIComponent(executionId)}`,
  productCategoryDeleteAction: (categoryId: string) =>
    `/dashboard/products/categories/actions/${encodeURIComponent(categoryId)}/delete`,
  productCategoryUpdateAction: (categoryId: string) =>
    `/dashboard/products/categories/actions/${encodeURIComponent(categoryId)}`,
  productCategoriesReorderAction: "/dashboard/products/categories/actions/reorder",
  productCategoriesBatchDeleteAction: "/dashboard/products/categories/actions/batch-delete",
  productCollectionDeleteAction: (collectionId: string) =>
    `/dashboard/products/collections/actions/${encodeURIComponent(collectionId)}/delete`,
  productCollectionUpdateAction: (collectionId: string) =>
    `/dashboard/products/collections/actions/${encodeURIComponent(collectionId)}`,
  productCollectionProductsAction: (collectionId: string) =>
    `/dashboard/products/collections/actions/${encodeURIComponent(collectionId)}/products`,
  productCollectionsBatchDeleteAction: "/dashboard/products/collections/actions/batch-delete",
  orders: "/dashboard/orders",
  ordersExportAction: "/dashboard/orders/actions/export",
  inquiries: "/dashboard/inquiries",
  inquiryAction: (inquiryId: string) =>
    `/dashboard/inquiries/actions/${encodeURIComponent(inquiryId)}`,
  orderCreateAction: "/dashboard/orders/actions/create",
  media: "/dashboard/media",
  customers: "/dashboard/customers",
  customersListAction: "/dashboard/customers/actions/list",
  promotions: "/dashboard/promotions",
  customerDetail: (customerId: string) => `/dashboard/customers/${encodeURIComponent(customerId)}`,
  orderAction: (orderId: string) => `/dashboard/orders/actions/${encodeURIComponent(orderId)}`,
  orderDetail: (orderId: string) => `/dashboard/orders/${encodeURIComponent(orderId)}`,
  editor: "/dashboard/editor",
  insights: "/dashboard/insights",
  notifications: "/dashboard/notifications",
  billing: "/dashboard/billing",
  settings: "/dashboard/settings",
  storefrontTemplate: "/dashboard/storefront/template",
  storefrontUnpublish: "/dashboard/storefront/unpublish",
  storefrontPublish: "/dashboard/storefront/publish",
  storefrontLanguages: "/dashboard/storefront/languages",
  storefrontAmharic: "/dashboard/storefront/languages/am",
  storefrontTranslations: "/dashboard/storefront/translations",
  storefrontLanguagesAction: "/dashboard/storefront/languages",
} as const;

export type DashboardRouteHref = Extract<
  (typeof dashboardRoutes)[keyof typeof dashboardRoutes],
  string
>;
