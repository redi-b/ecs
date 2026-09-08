import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getDisplayCustomerEmail,
  isSyntheticCustomerEmail,
  isWalkInCustomerEmail,
} from "./customer-identity.js";

test("hides technical email addresses without treating phone customers as generic walk-ins", () => {
  const phoneCustomer = "251911234567.tenant-1@customers.local";
  assert.equal(isSyntheticCustomerEmail(phoneCustomer), true);
  assert.equal(isWalkInCustomerEmail(phoneCustomer), false);
  assert.equal(getDisplayCustomerEmail(phoneCustomer), null);
  assert.equal(getDisplayCustomerEmail("buyer@example.com"), "buyer@example.com");
});
