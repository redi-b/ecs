import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalizeNotificationEventType,
  isAllowedNotificationEventType,
} from "./service.js";

describe("canonicalizeNotificationEventType", () => {
  it("maps legacy COD event to order.created", () => {
    assert.equal(canonicalizeNotificationEventType("cod_order.created"), "order.created");
  });

  it("leaves modern events unchanged", () => {
    assert.equal(canonicalizeNotificationEventType("order.created"), "order.created");
    assert.equal(canonicalizeNotificationEventType("payment.paid"), "payment.paid");
  });
});

describe("isAllowedNotificationEventType", () => {
  it("accepts legacy COD id via alias", () => {
    assert.equal(isAllowedNotificationEventType("cod_order.created"), true);
  });

  it("rejects unknown events", () => {
    assert.equal(isAllowedNotificationEventType("inventory.low"), false);
  });
});
