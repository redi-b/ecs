import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDashboardBreadcrumbTrail } from "./dashboard-breadcrumbs.js";
import { appRoutes, getNavigableAppRoutes } from "./navigation.js";
import { dashboardRoutes } from "./routes.js";

describe("getDashboardBreadcrumbTrail", () => {
  it("exposes taxonomy route constants", () => {
    assert.equal(dashboardRoutes.productCategories, "/dashboard/products/categories");
    assert.equal(dashboardRoutes.productCategoriesNew, "/dashboard/products/categories/new");
    assert.equal(
      dashboardRoutes.productCategoryCreateAction,
      "/dashboard/product-categories/actions/create",
    );
    assert.equal(dashboardRoutes.productCollections, "/dashboard/products/collections");
    assert.equal(dashboardRoutes.productCollectionsNew, "/dashboard/products/collections/new");
    assert.equal(
      dashboardRoutes.productCollectionCreateAction,
      "/dashboard/product-collections/actions/create",
    );
  });

  it("exposes product taxonomy routes as products navigation children", () => {
    const productsRoute = appRoutes.find((route) => route.id === "products");

    assert.deepEqual(
      productsRoute?.children?.map((route) => [route.title, route.href]),
      [
        ["All products", "/dashboard/products"],
        ["Categories", "/dashboard/products/categories"],
        ["Collections", "/dashboard/products/collections"],
        ["Product options", "/dashboard/products/options"],
      ],
    );
  });

  it("exposes taxonomy routes as direct command navigation targets", () => {
    const commandRoutes = getNavigableAppRoutes();

    assert.equal(
      commandRoutes.filter((route) => route.href === dashboardRoutes.products).length,
      1,
    );
    assert.deepEqual(
      commandRoutes
        .filter((route) => route.id.startsWith("product-"))
        .map((route) => [route.id, route.href]),
      [
        ["product-categories", "/dashboard/products/categories"],
        ["product-collections", "/dashboard/products/collections"],
        ["product-options", "/dashboard/products/options"],
      ],
    );
  });

  it("does not reserve a standalone product creation breadcrumb", () => {
    assert.notEqual(
      getDashboardBreadcrumbTrail("/dashboard/products/new").at(-1)?.id,
      "products-new",
    );
  });

  it("labels product category routes as nested products breadcrumbs", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/products/categories"), [
      { href: "/dashboard/products", id: "products", title: "Products" },
      { href: "/dashboard/products/categories", id: "product-categories", title: "Categories" },
    ]);
  });

  it("labels product category creation as a nested taxonomy breadcrumb", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/products/categories/new"), [
      { href: "/dashboard/products", id: "products", title: "Products" },
      { href: "/dashboard/products/categories", id: "product-categories", title: "Categories" },
      {
        href: "/dashboard/products/categories/new",
        id: "product-categories-new",
        title: "New category",
      },
    ]);
  });

  it("labels product collection routes as nested products breadcrumbs", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/products/collections"), [
      { href: "/dashboard/products", id: "products", title: "Products" },
      {
        href: "/dashboard/products/collections",
        id: "product-collections",
        title: "Collections",
      },
    ]);
  });

  it("labels product collection creation as a nested taxonomy breadcrumb", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/products/collections/new"), [
      { href: "/dashboard/products", id: "products", title: "Products" },
      {
        href: "/dashboard/products/collections",
        id: "product-collections",
        title: "Collections",
      },
      {
        href: "/dashboard/products/collections/new",
        id: "product-collections-new",
        title: "New collection",
      },
    ]);
  });

  it("labels saved options as a nested products breadcrumb", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail(dashboardRoutes.productOptions), [
      { href: "/dashboard/products", id: "products", title: "Products" },
      { href: "/dashboard/products/options", id: "product-options", title: "Product options" },
    ]);
  });

  it("labels the editor and translations as storefront destinations", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail(dashboardRoutes.editor), [
      {
        href: null,
        id: "storefront-section",
        title: "Storefront",
      },
      {
        href: "/dashboard/editor",
        id: "editor",
        title: "Editor",
      },
    ]);
    assert.deepEqual(getDashboardBreadcrumbTrail(dashboardRoutes.storefrontTranslations), [
      {
        href: null,
        id: "storefront-section",
        title: "Storefront",
      },
      {
        href: "/dashboard/storefront/translations",
        id: "storefront-translations",
        title: "Translations",
      },
    ]);
  });

  it("labels product detail pages as product details", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/products/prod_1"), [
      { href: "/dashboard/products", id: "products", title: "Products" },
      { href: "/dashboard/products/prod_1", id: "product-details", title: "Product details" },
    ]);
  });

  it("labels product edit pages as a child of the product detail page", () => {
    assert.equal(dashboardRoutes.productEdit("prod 1/2"), "/dashboard/products/prod%201%2F2/edit");
    assert.deepEqual(
      getDashboardBreadcrumbTrail("/dashboard/products/prod_1/edit", {
        "product-details": "Coffee beans",
      }),
      [
        { href: "/dashboard/products", id: "products", title: "Products" },
        { href: "/dashboard/products/prod_1", id: "product-details", title: "Coffee beans" },
        { href: "/dashboard/products/prod_1/edit", id: "product-edit", title: "Edit product" },
      ],
    );
  });

  it("uses product detail label overrides when available", () => {
    assert.deepEqual(
      getDashboardBreadcrumbTrail("/dashboard/products/prod_1", {
        "product-details": "Coffee beans",
      }),
      [
        { href: "/dashboard/products", id: "products", title: "Products" },
        { href: "/dashboard/products/prod_1", id: "product-details", title: "Coffee beans" },
      ],
    );
  });

  it("builds encoded order detail routes", () => {
    assert.equal(dashboardRoutes.orderDetail("order 1/2"), "/dashboard/orders/order%201%2F2");
  });

  it("labels order detail pages as a child of orders", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/orders/order_1"), [
      { href: "/dashboard/orders", id: "orders", title: "Orders" },
      { href: "/dashboard/orders/order_1", id: "order-details", title: "Order details" },
    ]);
  });

  it("labels customer detail pages as a child of customers", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/customers/cus_1"), [
      { href: "/dashboard/customers", id: "customers", title: "Customers" },
      {
        href: "/dashboard/customers/cus_1",
        id: "customer-details",
        title: "Customer details",
      },
    ]);
  });

  it("uses customer detail label overrides when available", () => {
    assert.deepEqual(
      getDashboardBreadcrumbTrail("/dashboard/customers/cus_1", {
        "customer-details": "Abebe Kebede",
      }),
      [
        { href: "/dashboard/customers", id: "customers", title: "Customers" },
        {
          href: "/dashboard/customers/cus_1",
          id: "customer-details",
          title: "Abebe Kebede",
        },
      ],
    );
  });

  it("uses order detail label overrides when available", () => {
    assert.deepEqual(
      getDashboardBreadcrumbTrail("/dashboard/orders/order_1", {
        "order-details": "#1024",
      }),
      [
        { href: "/dashboard/orders", id: "orders", title: "Orders" },
        { href: "/dashboard/orders/order_1", id: "order-details", title: "#1024" },
      ],
    );
  });

  it("keeps static app routes as single-page breadcrumbs", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/dashboard/orders"), [
      { href: "/dashboard/orders", id: "orders", title: "Orders" },
    ]);
  });
});
