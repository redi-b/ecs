import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatOrderSearchStatus } from "./search.js";

describe("formatOrderSearchStatus", () => {
  it("uses merchant-facing order labels", () => {
    assert.equal(formatOrderSearchStatus("pending", "order"), "Open");
    assert.equal(formatOrderSearchStatus("completed", "order"), "Completed");
  });

  it("cleans payment and fulfillment states", () => {
    assert.equal(formatOrderSearchStatus("not_paid", "payment"), "Not paid yet");
    assert.equal(formatOrderSearchStatus("not_fulfilled", "fulfillment"), "To prepare");
    assert.equal(formatOrderSearchStatus("partially_fulfilled", "fulfillment"), "Partly prepared");
  });

  it("falls back to readable words for newer Medusa states", () => {
    assert.equal(formatOrderSearchStatus("requires_review", "order"), "Requires Review");
  });
});
