import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDashboardBreadcrumbTrail } from "./dashboard-breadcrumbs.js";
import { appRoutes, getNavigableAppRoutes } from "./navigation.js";
import { dashboardRoutes } from "./routes.js";

describe("getDashboardBreadcrumbTrail", () => {
  it("exposes taxonomy route constants", () => {
    assert.equal(dashboardRoutes.productCategories, "/admin/products/categories");
    assert.equal(dashboardRoutes.productCategoriesNew, "/admin/products/categories/new");
    assert.equal(
      dashboardRoutes.productCategoryCreateAction,
      "/admin/product-categories/actions/create",
    );
    assert.equal(dashboardRoutes.productCollections, "/admin/products/collections");
    assert.equal(dashboardRoutes.productCollectionsNew, "/admin/products/collections/new");
    assert.equal(
      dashboardRoutes.productCollectionCreateAction,
      "/admin/product-collections/actions/create",
    );
  });

  it("exposes product taxonomy routes as products navigation children", () => {
    const productsRoute = appRoutes.find((route) => route.id === "products");

    assert.deepEqual(
      productsRoute?.children?.map((route) => [route.title, route.href]),
      [
        ["All products", "/admin/products"],
        ["Categories", "/admin/products/categories"],
        ["Collections", "/admin/products/collections"],
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
        ["product-categories", "/admin/products/categories"],
        ["product-collections", "/admin/products/collections"],
      ],
    );
  });

  it("does not reserve a standalone product creation breadcrumb", () => {
    assert.notEqual(getDashboardBreadcrumbTrail("/admin/products/new").at(-1)?.id, "products-new");
  });

  it("labels product category routes as nested products breadcrumbs", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/products/categories"), [
      { href: "/admin/products", id: "products", title: "Products" },
      { href: "/admin/products/categories", id: "product-categories", title: "Categories" },
    ]);
  });

  it("labels product category creation as a nested taxonomy breadcrumb", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/products/categories/new"), [
      { href: "/admin/products", id: "products", title: "Products" },
      { href: "/admin/products/categories", id: "product-categories", title: "Categories" },
      {
        href: "/admin/products/categories/new",
        id: "product-categories-new",
        title: "New category",
      },
    ]);
  });

  it("labels product collection routes as nested products breadcrumbs", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/products/collections"), [
      { href: "/admin/products", id: "products", title: "Products" },
      {
        href: "/admin/products/collections",
        id: "product-collections",
        title: "Collections",
      },
    ]);
  });

  it("labels product collection creation as a nested taxonomy breadcrumb", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/products/collections/new"), [
      { href: "/admin/products", id: "products", title: "Products" },
      {
        href: "/admin/products/collections",
        id: "product-collections",
        title: "Collections",
      },
      {
        href: "/admin/products/collections/new",
        id: "product-collections-new",
        title: "New collection",
      },
    ]);
  });

  it("labels product detail pages as product details", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/products/prod_1"), [
      { href: "/admin/products", id: "products", title: "Products" },
      { href: "/admin/products/prod_1", id: "product-details", title: "Product details" },
    ]);
  });

  it("labels product edit pages as a child of the product detail page", () => {
    assert.equal(dashboardRoutes.productEdit("prod 1/2"), "/admin/products/prod%201%2F2/edit");
    assert.deepEqual(
      getDashboardBreadcrumbTrail("/admin/products/prod_1/edit", {
        "product-details": "Coffee beans",
      }),
      [
        { href: "/admin/products", id: "products", title: "Products" },
        { href: "/admin/products/prod_1", id: "product-details", title: "Coffee beans" },
        { href: "/admin/products/prod_1/edit", id: "product-edit", title: "Edit product" },
      ],
    );
  });

  it("uses product detail label overrides when available", () => {
    assert.deepEqual(
      getDashboardBreadcrumbTrail("/admin/products/prod_1", {
        "product-details": "Coffee beans",
      }),
      [
        { href: "/admin/products", id: "products", title: "Products" },
        { href: "/admin/products/prod_1", id: "product-details", title: "Coffee beans" },
      ],
    );
  });

  it("builds encoded order detail routes", () => {
    assert.equal(dashboardRoutes.orderDetail("order 1/2"), "/admin/orders/order%201%2F2");
  });

  it("labels order detail pages as a child of orders", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/orders/order_1"), [
      { href: "/admin/orders", id: "orders", title: "Orders" },
      { href: "/admin/orders/order_1", id: "order-details", title: "Order details" },
    ]);
  });

  it("uses order detail label overrides when available", () => {
    assert.deepEqual(
      getDashboardBreadcrumbTrail("/admin/orders/order_1", {
        "order-details": "#1024",
      }),
      [
        { href: "/admin/orders", id: "orders", title: "Orders" },
        { href: "/admin/orders/order_1", id: "order-details", title: "#1024" },
      ],
    );
  });

  it("keeps static app routes as single-page breadcrumbs", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/orders"), [
      { href: "/admin/orders", id: "orders", title: "Orders" },
    ]);
  });
});
