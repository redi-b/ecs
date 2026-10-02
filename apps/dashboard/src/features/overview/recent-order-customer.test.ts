import assert from "node:assert/strict";
import { it } from "node:test";

import { formatRecentOrderCustomer } from "./recent-order-customer.js";

it("shows name and phone together, preferring phone over email", () => {
  assert.equal(
    formatRecentOrderCustomer({
      customerName: " Abebe ",
      customerPhone: " +251911000000 ",
      email: "a@example.com",
    }),
    "Abebe · +251911000000",
  );
});

it("falls back to email when there is no phone, retaining the customer name", () => {
  assert.equal(
    formatRecentOrderCustomer({
      customerName: "Abebe",
      customerPhone: " ",
      email: "a@example.com",
    }),
    "Abebe · a@example.com",
  );
});

it("handles walk-ins and partially available customer details", () => {
  assert.equal(formatRecentOrderCustomer({ customerPhone: "+251911000000" }), "+251911000000");
  assert.equal(formatRecentOrderCustomer({ customerName: "Abebe" }), "Abebe");
  assert.equal(formatRecentOrderCustomer({ email: "a@example.com" }), "a@example.com");
  assert.equal(
    formatRecentOrderCustomer({ customerName: " ", customerPhone: null, email: null }),
    null,
  );
});
