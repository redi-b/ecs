import assert from "node:assert/strict";
import test from "node:test";

import { defineCapabilityCatalog } from "./catalog.js";
import { decideCapability, parsePlanCapabilities } from "./policy.js";

const catalog = defineCapabilityCatalog({
  customDomains: { kind: "boolean", defaultValue: false },
  products: { kind: "limit", defaultValue: 0, window: "lifetime" },
});

test("persisted capability data fails closed", () => {
  assert.deepEqual(parsePlanCapabilities(catalog, { customDomains: "yes", products: -1 }), {
    customDomains: false,
    products: 0,
  });
});

test("inactive subscriptions cannot use enabled capabilities", () => {
  assert.deepEqual(
    decideCapability({
      capability: "customDomains",
      definition: catalog.customDomains,
      reserved: 0,
      status: "past_due",
      used: 0,
      value: true,
    }),
    {
      allowed: false,
      capability: "customDomains",
      reason: "subscription_inactive",
      remaining: null,
      source: "none",
    },
  );
});

test("limit decisions subtract active reservations as well as committed usage", () => {
  assert.deepEqual(
    decideCapability({
      amount: 2,
      capability: "products",
      definition: catalog.products,
      reserved: 2,
      status: "active",
      used: 7,
      value: 10,
    }),
    {
      allowed: false,
      capability: "products",
      reason: "limit_exhausted",
      remaining: 1,
      source: "plan",
    },
  );
});

test("a request inside remaining capacity is allowed", () => {
  const result = decideCapability({
    amount: 1,
    capability: "products",
    definition: catalog.products,
    reserved: 1,
    status: "trialing",
    used: 7,
    value: 10,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 2);
});
