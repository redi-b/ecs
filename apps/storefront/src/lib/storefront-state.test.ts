import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { storefrontState } from "./storefront-state.js";

describe("customer-facing storefront states", () => {
  it("shows 404 as an orientation aid without an internal identifier", () => {
    const state = storefrontState({ status: 404 });
    assert.equal(state.code, "404");
    assert.equal(state.actionHref, "/");
    assert.doesNotMatch(JSON.stringify(state), /pcat_|pcol_|stack|digest/i);
  });

  it("distinguishes access, closed-shop, rate-limit, and unexpected failures", () => {
    assert.equal(storefrontState({ status: 401 }).statusLabel, "Restricted");
    assert.equal(storefrontState({ status: 503, message: "shop_unpublished" }).statusLabel, "Temporarily closed");
    assert.equal(storefrontState({ status: 429 }).statusLabel, "Busy");
    assert.equal(storefrontState({ status: 500 }).statusLabel, "Temporary issue");
  });
});
