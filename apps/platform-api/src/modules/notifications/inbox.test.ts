import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildInAppDedupeKey, buildInAppHref, IN_APP_EVENT_SET } from "./inbox.js";

describe("buildInAppDedupeKey", () => {
  it("uses order id for commerce events", () => {
    assert.equal(
      buildInAppDedupeKey("order.created", { orderId: "ord_1" }),
      "order.created:ord_1",
    );
    assert.equal(
      buildInAppDedupeKey("payment.paid", { order_id: "ord_2", amount: "10" }),
      "payment.paid:ord_2",
    );
  });

  it("uses unique key for tests", () => {
    const key = buildInAppDedupeKey("notification.test", { testId: "t1" });
    assert.equal(key, "notification.test:t1");
  });
});

describe("buildInAppHref", () => {
  it("links to order detail when orderId present", () => {
    assert.equal(
      buildInAppHref("order.created", { orderId: "ord_1" }),
      "/admin/orders/ord_1",
    );
  });

  it("falls back to orders list", () => {
    assert.equal(buildInAppHref("order.cancelled", {}), "/admin/orders");
  });

  it("returns null for unknown non-commerce paths", () => {
    assert.equal(buildInAppHref("notification.test", {}), null);
  });
});

describe("IN_APP_EVENT_SET", () => {
  it("includes core commerce events and excludes channel tests", () => {
    assert.ok(IN_APP_EVENT_SET.has("order.created"));
    assert.ok(IN_APP_EVENT_SET.has("payment.failed"));
    assert.ok(!IN_APP_EVENT_SET.has("shop.published"));
    assert.ok(!IN_APP_EVENT_SET.has("notification.test"));
  });
});
