import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePlanEntitlements } from "../entitlements/catalog.js";
import { DEFAULT_PLAN_CATALOG, DEFAULT_PLANS } from "./plan-catalog.js";

describe("default plan catalog", () => {
  it("is the single complete source for seeded plan capabilities", () => {
    assert.equal(DEFAULT_PLANS.length, 2);
    assert.deepEqual(
      DEFAULT_PLANS.map((plan) => plan.id),
      [DEFAULT_PLAN_CATALOG.starter.id, DEFAULT_PLAN_CATALOG.growth.id],
    );

    for (const plan of DEFAULT_PLANS) {
      assert.deepEqual(parsePlanEntitlements(plan.features), plan.features);
    }
  });

  it("does not advertise numeric quotas before their write boundaries enforce them", () => {
    assert.deepEqual(DEFAULT_PLAN_CATALOG.starter.limits, {});
    assert.deepEqual(DEFAULT_PLAN_CATALOG.growth.limits, {});
  });

  it("does not sell custom domains while operational availability is deferred", () => {
    assert.equal(DEFAULT_PLAN_CATALOG.starter.features.customDomains, false);
    assert.equal(DEFAULT_PLAN_CATALOG.growth.features.customDomains, false);
  });
});
