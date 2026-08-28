import assert from "node:assert/strict";
import test from "node:test";

import { merchantDashboardSummarySchema } from "@ecs/contracts";

import { dashboardDemoFixture } from "./dashboard-demo-fixture";

test("dashboard demo fixture stays inside the public merchant summary contract", () => {
  assert.doesNotThrow(() => merchantDashboardSummarySchema.parse(dashboardDemoFixture));
  assert.equal(dashboardDemoFixture.tenant.id, "demo-tenant");
  assert.equal(dashboardDemoFixture.operations?.unavailable.length, 0);
});
