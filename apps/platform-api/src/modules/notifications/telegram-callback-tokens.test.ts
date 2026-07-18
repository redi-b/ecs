import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildOrderActionCallbackData,
  buildOrderActionKeyboard,
  parseOrderActionCallbackData,
} from "./telegram-callback-tokens.js";

describe("telegram callback tokens", () => {
  const secret = "test-secret";
  const tenantId = "11111111-2222-4333-8444-555555555555";
  const orderId = "order_01HTESTORDERID99";

  it("round-trips all order actions under 64 bytes", () => {
    for (const action of ["paid", "ready", "cancel", "details"] as const) {
      const data = buildOrderActionCallbackData({
        action,
        orderId,
        tenantId,
        secret,
      });
      assert.ok(data);
      assert.ok(Buffer.byteLength(data, "utf8") <= 64);
      const parsed = parseOrderActionCallbackData(data, {
        secret,
        tenantIds: [tenantId],
      });
      assert.equal(parsed.ok, true);
      if (parsed.ok) {
        assert.equal(parsed.action, action);
        assert.equal(parsed.orderId, orderId);
        assert.equal(parsed.tenantId, tenantId);
      }
    }
  });

  it("rejects wrong tenant and bad signatures", () => {
    const data = buildOrderActionCallbackData({
      action: "paid",
      orderId,
      tenantId,
      secret,
    });
    assert.ok(data);
    const wrongTenant = parseOrderActionCallbackData(data, {
      secret,
      tenantIds: ["aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"],
    });
    assert.equal(wrongTenant.ok, false);
    const wrongSecret = parseOrderActionCallbackData(data, {
      secret: "other",
      tenantIds: [tenantId],
    });
    assert.equal(wrongSecret.ok, false);
  });

  it("builds a four-button keyboard in two rows", () => {
    const keyboard = buildOrderActionKeyboard({ orderId, tenantId, secret });
    assert.ok(keyboard);
    assert.equal(keyboard.inline_keyboard.length, 2);
    assert.equal(keyboard.inline_keyboard[0]?.[0]?.text, "Mark paid");
    assert.equal(keyboard.inline_keyboard[0]?.[1]?.text, "Mark ready");
    assert.equal(keyboard.inline_keyboard[1]?.[0]?.text, "Details");
    assert.equal(keyboard.inline_keyboard[1]?.[1]?.text, "Cancel order");
  });
});

