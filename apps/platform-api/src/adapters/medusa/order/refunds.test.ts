import assert from "node:assert/strict";
import test from "node:test";

import { decodeRefundNote, encodeRefundNote, getOrderRefundSummary } from "./refunds.js";
import { normalizeOrder } from "./normalize.js";

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

test("legacy manually-paid orders expose a refundable balance for native ledger repair", () => {
  const order = normalizeOrder(
    {
      id: "order_legacy",
      sales_channel_id: "sc_1",
      total: 1200,
      payment_status: "not_paid",
      metadata: { payment_status_override: "paid" },
    },
    "sc_1",
  )[0];

  assert.equal(order?.paymentStatus, "captured");
  assert.equal(order?.refundableTotal, 1200);
  assert.equal(order?.refundedTotal, 0);
});
