import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseBillingIntervalMs } from "./schedule-billing-jobs.js";

describe("parseBillingIntervalMs", () => {
  it("uses fallback for empty values", () => {
    assert.equal(parseBillingIntervalMs(undefined, 1000), 1000);
    assert.equal(parseBillingIntervalMs("", 1000), 1000);
    assert.equal(parseBillingIntervalMs("  ", 1000), 1000);
  });

  it("parses integers including zero (disabled)", () => {
    assert.equal(parseBillingIntervalMs("0", 1000), 0);
    assert.equal(parseBillingIntervalMs("300000", 1000), 300_000);
  });

  it("falls back on non-numeric input", () => {
    assert.equal(parseBillingIntervalMs("nope", 5000), 5000);
  });
});
