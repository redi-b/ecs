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
    assert.equal(canAccessDashboardRoute("/dashboard", ["products.read"]), false);
    assert.equal(canAccessDashboardRoute("/dashboard/products", ["products.read"]), true);
    assert.equal(getFirstPermittedDashboardHref(["products.read"]), "/dashboard/products");
  });

  it("distinguishes read-only storefront access from product editing", () => {
    assert.equal(canAccessDashboardRoute("/dashboard/editor", ["storefront.read"]), true);
    assert.equal(canAccessDashboardRoute("/dashboard/editor", ["storefront.edit"]), false);
    assert.equal(canAccessDashboardRoute("/dashboard/products/prod_1/edit", ["products.read"]), false);
    assert.equal(
      canAccessDashboardRoute("/dashboard/products/prod_1/edit", ["products.update"]),
      false,
    );
    assert.equal(
      canAccessDashboardRoute("/dashboard/products/prod_1/edit", ["products.read", "products.update"]),
      true,
    );
  });

  it("classifies every current dashboard page family", () => {
    const pages = [
      "/dashboard",
      "/dashboard/billing",
      "/dashboard/customers",
      "/dashboard/customers/customer_1",
      "/dashboard/editor",
      "/dashboard/inquiries",
      "/dashboard/insights",
      "/dashboard/insights/traffic",
      "/dashboard/media",
      "/dashboard/orders",
      "/dashboard/orders/order_1",
      "/dashboard/products",
      "/dashboard/products/product_1",
      "/dashboard/products/product_1/edit",
      "/dashboard/products/categories",
      "/dashboard/products/categories/new",
      "/dashboard/products/collections",
      "/dashboard/products/collections/new",
      "/dashboard/products/options",
      "/dashboard/promotions",
      "/dashboard/settings",
    ];
    assert.deepEqual(
      pages.filter((page) => !getDashboardRouteRequirement(page)),
      [],
    );
  });

  it("fails closed for an unclassified dashboard page", () => {
    assert.equal(canAccessDashboardRoute("/dashboard/new-unclassified-page", ["overview.read"]), false);
  });

  it("classifies every dashboard page in the filesystem", async () => {
    const root = fileURLToPath(new URL("../app/dashboard/(dashboard)", import.meta.url));
    const files = await readdir(root, { recursive: true });
    const routes = files
      .filter((file) => file === "page.tsx" || file.endsWith("/page.tsx"))
      .map((file) => {
        const route = file
          .replace(/\/?page\.tsx$/, "")
          .replace(/\[(?:\.\.\.)?[^\]]+\]/g, "test-id");
        return route ? `/dashboard/${route}` : "/dashboard";
      });

    assert.deepEqual(
      routes.filter((route) => !getDashboardRouteRequirement(route)),
      [],
    );
  });
});
