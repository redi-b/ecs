import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDashboardBreadcrumbTrail } from "./dashboard-breadcrumbs.js";
import { dashboardRoutes } from "./routes.js";

describe("getDashboardBreadcrumbTrail", () => {
  it("labels product creation as a child of products", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/products/new"), [
      { href: "/admin/products", id: "products", title: "Products" },
      { href: "/admin/products/new", id: "products-new", title: "New product" },
    ]);
  });

  it("labels product detail pages as product details", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/products/prod_1"), [
      { href: "/admin/products", id: "products", title: "Products" },
      { href: "/admin/products/prod_1", id: "product-details", title: "Product details" },
    ]);
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
