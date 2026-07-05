import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder } from "@ecs/contracts";

import {
  filterOrdersForTable,
  formatOrderDate,
  formatOrderDisplayId,
  formatOrderMoney,
  getOrderSearchText,
  getOrderTableCounts,
  getOrderTotalSortValue,
  normalizeOrderLifecycle,
} from "./order-table-state.js";

const orders: MerchantOrder[] = [
  {
    id: "order_1",
    displayId: 1024,
    email: "buyer@example.com",
    status: "pending",
    paymentStatus: "captured",
    fulfillmentStatus: "not_fulfilled",
    currencyCode: "etb",
    total: 1250,
    delivery: {
      choice: "delivery",
      customerName: "Abebe Kebede",
      customerPhone: "0911000000",
      landmark: "Near square",
      notes: null,
    },
    fulfillments: [],
    shippingAddress: undefined,
    createdAt: "2026-07-01T10:00:00.000Z",
    updatedAt: "2026-07-02T10:00:00.000Z",
  },
  {
    id: "order_2",
    displayId: null,
    email: null,
    status: "completed",
    paymentStatus: "awaiting",
    fulfillmentStatus: "fulfilled",
    currencyCode: "etb",
    total: null,
    delivery: undefined,
    fulfillments: [
      {
        id: "ful_1",
        canceledAt: null,
        deliveredAt: "2026-07-03T10:00:00.000Z",
        shippedAt: null,
      },
    ],
    shippingAddress: undefined,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "order_3",
    displayId: 2048,
    email: "pickup@example.com",
    status: "open",
    paymentStatus: "pending",
    fulfillmentStatus: "requires_action",
    currencyCode: "usd",
    total: 500,
    delivery: {
      choice: "pickup",
      customerName: "Sara Tesfaye",
      customerPhone: "0922000000",
      landmark: "Bole counter",
      notes: null,
    },
    fulfillments: [],
    shippingAddress: undefined,
    createdAt: "2026-07-04T12:30:00.000Z",
    updatedAt: "2026-07-04T12:30:00.000Z",
  },
  {
    id: "order_4",
    displayId: 4096,
    email: "cancel@example.com",
    status: "canceled",
    paymentStatus: "not_paid",
    fulfillmentStatus: null,
    currencyCode: null,
    total: 0,
    delivery: undefined,
    fulfillments: [],
    shippingAddress: undefined,
    createdAt: "2026-07-05T00:00:00.000Z",
    updatedAt: "2026-07-05T00:00:00.000Z",
  },
  {
    id: "order_5",
    displayId: 8192,
    email: "open@example.com",
    status: "pending",
    paymentStatus: null,
    fulfillmentStatus: null,
    currencyCode: "etb",
    total: 275,
    delivery: undefined,
    fulfillments: [],
    shippingAddress: undefined,
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
  },
];

const paidOrder = orders[0];
const completedOrder = orders[1];
const paymentPendingOrder = orders[2];
const canceledOrder = orders[3];
const openOrder = orders[4];

assert.ok(paidOrder);
assert.ok(completedOrder);
assert.ok(paymentPendingOrder);
assert.ok(canceledOrder);
assert.ok(openOrder);

describe("order table state", () => {
  it("builds searchable text from order, customer, delivery, payment, and fulfillment fields", () => {
    const searchText = getOrderSearchText(paidOrder);

    assert.match(searchText, /order_1/);
    assert.match(searchText, /1024/);
    assert.match(searchText, /buyer@example\.com/);
    assert.match(searchText, /abebe kebede/);
    assert.match(searchText, /0911000000/);
    assert.match(searchText, /delivery/);
    assert.match(searchText, /near square/);
    assert.match(searchText, /pending/);
    assert.match(searchText, /captured/);
    assert.match(searchText, /not_fulfilled/);
  });

  it("filters the current page by search text", () => {
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "all", query: "abebe" }).map((order) => order.id),
      ["order_1"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "all", query: "  BOLE counter  " }).map(
        (order) => order.id,
      ),
      ["order_3"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "all", query: "   " }).map((order) => order.id),
      ["order_1", "order_2", "order_3", "order_4", "order_5"],
    );
  });

  it("filters the current page by lifecycle", () => {
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "open", query: "" }).map((order) => order.id),
      ["order_5"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "completed", query: "" }).map(
        (order) => order.id,
      ),
      ["order_2"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "canceled", query: "" }).map((order) => order.id),
      ["order_4"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "needs_fulfillment", query: "" }).map(
        (order) => order.id,
      ),
      ["order_1", "order_3"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "fulfilled", query: "" }).map((order) => order.id),
      ["order_2"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "payment_pending", query: "" }).map(
        (order) => order.id,
      ),
      ["order_2", "order_3"],
    );
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "paid", query: "" }).map((order) => order.id),
      ["order_1"],
    );
  });

  it("combines lifecycle and search filters", () => {
    assert.deepEqual(
      filterOrdersForTable(orders, { lifecycle: "needs_fulfillment", query: "pickup" }).map(
        (order) => order.id,
      ),
      ["order_3"],
    );
  });

  it("normalizes lifecycle states by order, fulfillment, and payment status", () => {
    assert.equal(normalizeOrderLifecycle(openOrder), "open");
    assert.equal(normalizeOrderLifecycle(completedOrder), "completed");
    assert.equal(normalizeOrderLifecycle(canceledOrder), "canceled");
    assert.equal(normalizeOrderLifecycle(paidOrder), "needs_fulfillment");
    assert.equal(normalizeOrderLifecycle({ ...paidOrder, fulfillmentStatus: "shipped" }), "paid");
    assert.equal(normalizeOrderLifecycle(paymentPendingOrder), "needs_fulfillment");
    assert.equal(
      normalizeOrderLifecycle({ ...paymentPendingOrder, fulfillmentStatus: "processing" }),
      "payment_pending",
    );
    assert.equal(normalizeOrderLifecycle({ ...openOrder, status: " Open " }), "open");
  });

  it("formats display ids, totals, money, dates, and counts", () => {
    assert.equal(formatOrderDisplayId(paidOrder), "#1024");
    assert.equal(formatOrderDisplayId(completedOrder), "order_2");
    assert.equal(getOrderTotalSortValue(paidOrder), 1250);
    assert.equal(getOrderTotalSortValue(completedOrder), null);
    assert.equal(formatOrderMoney(null, "etb"), "Not available");
    assert.equal(formatOrderMoney(1250, "etb"), "ETB 1,250.00");
    assert.equal(formatOrderMoney(500, null), "ETB 500.00");
    assert.equal(formatOrderDate("2026-07-01T10:00:00.000Z"), "Jul 1, 2026");
    assert.equal(formatOrderDate(null), "No date");
    assert.deepEqual(
      getOrderTableCounts({
        filteredCount: 1,
        filters: { lifecycle: "fulfilled", query: "" },
        pageCount: 2,
        totalCount: 12,
      }),
      { filteredCount: 1, hasActiveFilter: true, pageCount: 2, totalCount: 12 },
    );
    assert.deepEqual(
      getOrderTableCounts({
        filteredCount: 5,
        filters: { lifecycle: "all", query: "   " },
        pageCount: 5,
        totalCount: 5,
      }),
      { filteredCount: 5, hasActiveFilter: false, pageCount: 5, totalCount: 5 },
    );
  });
});
