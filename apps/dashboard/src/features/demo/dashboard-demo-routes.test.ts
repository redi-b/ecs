import assert from "node:assert/strict";
import { test } from "node:test";

import { appRoutes } from "@/lib/navigation";
import {
  getDashboardPathFromDemo,
  getDemoInsightsHref,
  getDemoPathFromDashboard,
  getDemoSidebarRoute,
} from "./dashboard-demo-routes.js";

test("the demo keeps every primary dashboard capability visible", () => {
  const demoRoutes = appRoutes.map(getDemoSidebarRoute);
  assert.deepEqual(
    demoRoutes.map((route) => route.id),
    appRoutes.map((route) => route.id),
  );
  assert.equal(demoRoutes.find((route) => route.id === "editor")?.href, "/demo/editor");
  assert.equal(demoRoutes.find((route) => route.id === "customers")?.disabled, true);
  const products = demoRoutes.find((route) => route.id === "products");
  assert.deepEqual(
    products?.children?.map((route) => route.id),
    ["products-list", "product-categories", "product-collections"],
  );
  assert.notEqual(products?.children?.find((route) => route.id === "products-list")?.disabled, true);
  assert.equal(
    products?.children?.find((route) => route.id === "product-categories")?.disabled,
    true,
  );
});

test("demo insight reports stay inside the public preview route family", () => {
  assert.equal(getDemoInsightsHref("overview"), "/demo/insights");
  assert.equal(getDemoInsightsHref("sales"), "/demo/insights/sales");
});

test("demo detail routes round-trip without escaping to the authenticated dashboard", () => {
  assert.equal(getDashboardPathFromDemo("/demo/products/prod_1"), "/admin/products/prod_1");
  assert.equal(getDemoPathFromDashboard("/admin/products/prod_1"), "/demo/products/prod_1");
  assert.equal(getDashboardPathFromDemo("/demo/insights/sales"), "/admin/insights/sales");
  assert.equal(getDemoPathFromDashboard("/admin/insights/sales"), "/demo/insights/sales");
  assert.equal(getDemoPathFromDashboard("/admin/customers/cus_1"), "/demo");
});
