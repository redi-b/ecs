import assert from "node:assert/strict";
import test from "node:test";

import { allocateManualOrderDiscount } from "./manual-order-discount";

test("allocates a fixed discount proportionally without losing rounding remainder", () => {
  const result = allocateManualOrderDiscount(
    [
      { id: "a", quantity: 1, unitPrice: 100 },
      { id: "b", quantity: 1, unitPrice: 200 },
    ],
    { type: "fixed", value: 100 },
  );
  assert.equal(
    result.adjustments.reduce((sum, row) => sum + row.amount, 0),
    100,
  );
  assert.deepEqual(result.adjustments, [
    { amount: 33.33, itemId: "a" },
    { amount: 66.67, itemId: "b" },
  ]);
});

test("rejects discounts greater than the merchandise subtotal", () => {
  assert.throws(
    () =>
      allocateManualOrderDiscount([{ id: "a", quantity: 1, unitPrice: 100 }], {
        type: "fixed",
        value: 101,
      }),
    /invalid_manual_order_discount/,
  );
});
