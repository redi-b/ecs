import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  badgeLabel,
  collectNotificationArrivals,
  formatInboxMoney,
  parseInboxDetails,
} from "./notification-center.js";

describe("notification arrival presentation", () => {
  const item = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    eventType: "order.created",
    title: `Order ${id}`,
    body: "A new order was placed",
    href: `/dashboard/orders/${id}`,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  });

  it("caps the visual badge after nine while preserving exact small counts", () => {
    assert.equal(badgeLabel(0), null);
    assert.equal(badgeLabel(1), "1");
    assert.equal(badgeLabel(9), "9");
    assert.equal(badgeLabel(10), "9+");
  });

  it("seeds initial unseen items without announcing them", () => {
    const known = new Set<string>();
    assert.deepEqual(collectNotificationArrivals([item("1")], known, false), []);
    assert.deepEqual(collectNotificationArrivals([item("1")], known, true), []);
  });

  it("announces each new occurrence once and ignores already-seen items", () => {
    const known = new Set<string>(["1:1"]);
    const arrivals = collectNotificationArrivals(
      [item("2", { occurrenceCount: 1 }), item("1", { occurrenceCount: 2 }), item("3", { seenAt: new Date().toISOString() })],
      known,
      true,
    );
    assert.deepEqual(arrivals.map(({ id }) => id), ["2", "1"]);
    assert.deepEqual(collectNotificationArrivals([item("2"), item("1", { occurrenceCount: 2 })], known, true), []);
  });
});

describe("formatInboxMoney", () => {
  it("formats raw decimal totals as ETB", () => {
    assert.equal(formatInboxMoney("10880.000000000000"), "ETB 10,880");
    assert.equal(formatInboxMoney("6292"), "ETB 6,292");
  });

  it("leaves already-labeled amounts alone", () => {
    assert.equal(formatInboxMoney("ETB 6,292"), "ETB 6,292");
  });
});

describe("parseInboxDetails", () => {
  it("extracts labeled rows and formats money", () => {
    const details = parseInboxDetails({
      id: "1",
      eventType: "order.cancelled",
      title: "Order cancelled 10",
      body: "Order cancelled 10\nTotal: 10880.000000000000\nCustomer: Sara",
      href: "/dashboard/orders",
      readAt: null,
      createdAt: new Date().toISOString(),
    });

    assert.deepEqual(details, [
      { label: "Total", value: "ETB 10,880" },
      { label: "Customer", value: "Sara" },
    ]);
  });

  it("keeps payment details scannable and skips footer prose", () => {
    const details = parseInboxDetails({
      id: "2",
      eventType: "payment.paid",
      title: "Payment received for #13",
      body: [
        "Payment received for order #13",
        "Order: #13",
        "Amount: ETB 6,292",
        "Items: 2 items",
        "Customer: Mahi Kebede",
        "Open the order in the dashboard for full details.",
      ].join("\n"),
      href: "/dashboard/orders/13",
      readAt: null,
      createdAt: new Date().toISOString(),
    });

    assert.equal(details.length, 3);
    assert.equal(details[0]?.label, "Amount");
    assert.equal(details[0]?.value, "ETB 6,292");
    assert.ok(details.every((row) => !row.value.toLowerCase().includes("open the order")));
  });

  it("drops order label when already present in the title", () => {
    const details = parseInboxDetails({
      id: "3",
      eventType: "payment.paid",
      title: "Payment received for #13",
      body: "Order: #13\nAmount: 1200\nCustomer: Abebe",
      href: null,
      readAt: null,
      createdAt: new Date().toISOString(),
    });

    assert.deepEqual(
      details.map((row) => row.label),
      ["Amount", "Customer"],
    );
    assert.equal(details[0]?.value, "ETB 1,200");
  });
});
