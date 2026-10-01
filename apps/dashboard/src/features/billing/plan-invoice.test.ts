import assert from "node:assert/strict";
import test from "node:test";
import type { MerchantBillingStatus } from "@ecs/contracts";
import { findPlanInvoice } from "./plan-invoice";

const seeded = {
  id: "seeded",
  amount: "499",
  currency: "ETB",
  status: "pending",
  provider: "manual",
  providerReference: "demo-next",
  dueAt: null,
  paidAt: null,
  createdAt: "2026-10-01T00:00:00Z",
} satisfies MerchantBillingStatus["invoices"][number];

test("selecting Growth must not pay an unrelated seeded invoice", () => {
  assert.equal(findPlanInvoice([seeded], "growth"), null);
});

test("selecting Growth pays its invoice, not an earlier invoice for a different plan", () => {
  const growth = { ...seeded, id: "growth-invoice", provider: "plan:growth" };
  assert.equal(findPlanInvoice([seeded, growth], "growth")?.id, growth.id);
  assert.equal(findPlanInvoice([{ ...growth, status: "paid" }], "growth"), null);
});

test("issued plan identity survives switching payment provider and wins over provider hints", () => {
  const growth = { ...seeded, id: "growth", planId: "growth", provider: "chapa" };
  assert.equal(findPlanInvoice([growth], "growth")?.id, "growth");
  assert.equal(findPlanInvoice([{ ...growth, provider: "plan:scale" }], "scale"), null);
});
