import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatInboxMoney,
  parseInboxDetails,
} from "./notification-center.js";

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
      href: "/admin/orders",
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
      href: "/admin/orders/13",
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
