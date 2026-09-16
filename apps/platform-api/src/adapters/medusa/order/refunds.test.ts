import assert from "node:assert/strict";
import test from "node:test";

import { decodeRefundNote, encodeRefundNote, getOrderRefundSummary } from "./refunds.js";

test("round-trips merchant-facing manual refund details", () => {
  const note = encodeRefundNote({
    amount: 250,
    method: "telebirr",
    reason: "customer_request",
    reference: "TX-123",
    note: "Customer confirmed receipt",
  });

  assert.deepEqual(decodeRefundNote(note), {
    method: "telebirr",
    reason: "customer_request",
    reference: "TX-123",
    note: "Customer confirmed receipt",
  });
});

test("calculates partial refund history and remaining captured amount", () => {
  const encoded = encodeRefundNote({
    amount: 300,
    method: "bank_transfer",
    reason: "item_unavailable",
    reference: "REF-1",
  });
  const summary = getOrderRefundSummary({
    payment_collections: [
      {
        payments: [
          {
            id: "pay_1",
            amount: 1_000,
            captures: [{ id: "capt_1" }],
            refunds: [
              {
                id: "refund_1",
                amount: 300,
                note: encoded,
                created_at: "2026-09-16T10:00:00.000Z",
              },
            ],
          },
        ],
      },
    ],
  });

  assert.deepEqual(summary, {
    refundableTotal: 700,
    refundedTotal: 300,
    refunds: [
      {
        id: "refund_1",
        amount: 300,
        method: "bank_transfer",
        reason: "item_unavailable",
        reference: "REF-1",
        note: null,
        createdAt: "2026-09-16T10:00:00.000Z",
      },
    ],
  });
});
