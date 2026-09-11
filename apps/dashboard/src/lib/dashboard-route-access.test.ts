import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  canAccessDashboardRoute,
  getDashboardRouteRequirement,
  getFirstPermittedDashboardHref,
} from "./dashboard-route-access.js";

describe("dashboard route access", () => {
  it("treats overview as a page permission rather than dashboard membership", () => {
    assert.equal(canAccessDashboardRoute("/admin", ["products.read"]), false);
    assert.equal(canAccessDashboardRoute("/admin/products", ["products.read"]), true);
    assert.equal(getFirstPermittedDashboardHref(["products.read"]), "/admin/products");
  });

  it("distinguishes read-only storefront access from product editing", () => {
    assert.equal(canAccessDashboardRoute("/admin/editor", ["storefront.read"]), true);
    assert.equal(canAccessDashboardRoute("/admin/editor", ["storefront.edit"]), false);
    assert.equal(canAccessDashboardRoute("/admin/products/prod_1/edit", ["products.read"]), false);
    assert.equal(
      canAccessDashboardRoute("/admin/products/prod_1/edit", ["products.update"]),
      false,
    );
    assert.equal(
      canAccessDashboardRoute("/admin/products/prod_1/edit", ["products.read", "products.update"]),
      true,
    );
  });

  it("classifies every current dashboard page family", () => {
    const pages = [
      "/admin",
      "/admin/billing",
      "/admin/customers",
      "/admin/customers/customer_1",
      "/admin/editor",
      "/admin/inquiries",
      "/admin/insights",
      "/admin/insights/traffic",
      "/admin/media",
      "/admin/orders",
      "/admin/orders/order_1",
      "/admin/products",
      "/admin/products/product_1",
      "/admin/products/product_1/edit",
      "/admin/products/categories",
      "/admin/products/categories/new",
      "/admin/products/collections",
      "/admin/products/collections/new",
      "/admin/products/options",
      "/admin/promotions",
      "/admin/settings",
    ];
    assert.deepEqual(
      pages.filter((page) => !getDashboardRouteRequirement(page)),
      [],
    );
  });

  it("fails closed for an unclassified dashboard page", () => {
    assert.equal(canAccessDashboardRoute("/admin/new-unclassified-page", ["overview.read"]), false);
  });

  it("classifies every dashboard page in the filesystem", async () => {
    const root = fileURLToPath(new URL("../app/admin/(dashboard)", import.meta.url));
    const files = await readdir(root, { recursive: true });
    const routes = files
      .filter((file) => file === "page.tsx" || file.endsWith("/page.tsx"))
      .map((file) => {
        const route = file
          .replace(/\/?page\.tsx$/, "")
          .replace(/\[(?:\.\.\.)?[^\]]+\]/g, "test-id");
        return route ? `/admin/${route}` : "/admin";
      });

    assert.deepEqual(
      routes.filter((route) => !getDashboardRouteRequirement(route)),
      [],
    );
  });
});
