import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getDashboardBreadcrumbTrail } from "./dashboard-breadcrumbs.js";

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

  it("keeps static app routes as single-page breadcrumbs", () => {
    assert.deepEqual(getDashboardBreadcrumbTrail("/admin/orders"), [
      { href: "/admin/orders", id: "orders", title: "Orders" },
    ]);
  });
});
