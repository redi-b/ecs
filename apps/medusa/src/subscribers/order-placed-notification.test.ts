import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrderCostSnapshotRetryError, requireOrderCostSnapshot } from "./order-placed-notification";

describe("order placed cost snapshot retry", () => {
  it("accepts a committed idempotent snapshot", () => {
    assert.doesNotThrow(() =>
      requireOrderCostSnapshot({ body: { captured: 1 }, ok: true, status: 201 }, "order_1"),
    );
  });

  it("fails the event delivery so Medusa can retry a missing snapshot", () => {
    assert.throws(
      () => requireOrderCostSnapshot({ error: "connection refused", ok: false }, "order_1"),
      OrderCostSnapshotRetryError,
    );
  });
});
