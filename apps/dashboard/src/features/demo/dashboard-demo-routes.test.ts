import assert from "node:assert/strict";
import { test } from "node:test";

import { appRoutes } from "@/lib/navigation";
import { getDemoInsightsHref, getDemoSidebarRoute } from "./dashboard-demo-routes.js";

test("the demo keeps every primary dashboard capability visible", () => {
  const demoRoutes = appRoutes.map(getDemoSidebarRoute);
  assert.deepEqual(
    demoRoutes.map((route) => route.id),
    appRoutes.map((route) => route.id),
  );
  assert.equal(demoRoutes.find((route) => route.id === "editor")?.href, "/demo/editor");
  assert.equal(demoRoutes.find((route) => route.id === "customers")?.disabled, true);
});

test("demo insight reports stay inside the public preview route family", () => {
  assert.equal(getDemoInsightsHref("overview"), "/demo/insights");
  assert.equal(getDemoInsightsHref("sales"), "/demo/insights/sales");
});
