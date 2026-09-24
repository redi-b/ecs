import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatOrderReference } from "./order-reference.js";

describe("formatOrderReference", () => {
  it("prefers a tenant-safe custom display id", () => {
    assert.equal(formatOrderReference("order_internal", "BOLE-1042"), "BOLE-1042");
  });

  it("never exposes Medusa's global sequential display id", () => {
    assert.equal(formatOrderReference("order_01JABCDEF234567890"), "ORD-F234567890");
  });
});
