import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getOperationalCustomerEmail,
  isSyntheticCustomerEmail,
  normalizeOperationalPhone,
} from "./customer-identity.js";

test("normalizes common Ethiopian mobile formats", () => {
  assert.equal(normalizeOperationalPhone("0911 234 567"), "251911234567");
  assert.equal(normalizeOperationalPhone("+251 911 234 567"), "251911234567");
  assert.equal(normalizeOperationalPhone("911234567"), "251911234567");
});

test("uses real email when supplied and a stable internal email otherwise", () => {
  assert.equal(
    getOperationalCustomerEmail({
      email: " Buyer@Example.com ",
      phone: "0911234567",
      tenantId: "tenant-1",
    }),
    "buyer@example.com",
  );
  assert.equal(
    getOperationalCustomerEmail({ phone: "0911234567", tenantId: "tenant-1" }),
    "251911234567.tenant-1@customers.local",
  );
  assert.equal(getOperationalCustomerEmail({ phone: "123", tenantId: "tenant-1" }), null);
});

test("recognizes internal customer addresses", () => {
  assert.equal(isSyntheticCustomerEmail("251911234567.tenant-1@customers.local"), true);
  assert.equal(isSyntheticCustomerEmail("buyer@example.com"), false);
});
