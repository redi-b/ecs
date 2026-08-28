import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MerchantOrder } from "@ecs/contracts";
import {
  buildOrderCsv,
  exportOrdersToCsv,
  MAX_ORDER_EXPORT_COUNT,
  orderExportFilename,
} from "./order-export.js";

function order(overrides: Partial<MerchantOrder> = {}): MerchantOrder {
  return {
    id: "order_sensitive_internal_id",
    displayId: 42,
    customDisplayId: "AA-42",
    email: "customer@example.com",
    customerId: "cus_secret",
    status: "pending",
    paymentStatus: "captured",
    fulfillmentStatus: "not_fulfilled",
    paymentMethod: "cod",
    paymentReference: "secret-payment-reference",
    settlement: { method: "telebirr", reference: "secret-settlement-reference" },
    note: "private merchant note",
    currencyCode: "etb",
    subtotal: 100,
    shippingTotal: 20,
    discountTotal: 5,
    total: 115,
    itemCount: 2,
    delivery: {
      choice: "delivery",
      customerName: "ሰላም",
      customerPhone: "+251900000000",
      landmark: "private landmark",
      notes: "private delivery note",
    },
    shippingAddress: {
      firstName: "Private",
      lastName: "Customer",
      phone: "+251911111111",
      address1: "private address",
      address2: null,
      city: "Addis Ababa",
      province: null,
      postalCode: null,
      countryCode: "et",
    },
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T01:00:00.000Z",
    ...overrides,
  };
}

describe("operational order CSV export", () => {
  it("includes operational fields while excluding customer and payment identifiers", () => {
    const { csv, rowCount } = buildOrderCsv([order({ customDisplayId: "=unsafe" })]);
    assert.equal(rowCount, 1);
    assert.match(csv, /^\uFEFF"order_reference"/);
    assert.equal(csv.includes("schema_version"), false);
    assert.equal(csv.includes("ecs-orders-v1"), false);
    assert.match(csv, /"'=unsafe"/);
    assert.match(csv, /telebirr/);
    for (const sensitive of [
      "customer@example.com",
      "cus_secret",
      "secret-payment-reference",
      "secret-settlement-reference",
      "+251900000000",
      "private address",
      "private merchant note",
      "private landmark",
    ]) {
      assert.equal(csv.includes(sensitive), false, sensitive);
    }
  });

  it("uses a second-precise UTC timestamp in filenames", () => {
    assert.equal(
      orderExportFilename(new Date("2026-08-26T14:30:15.987Z")),
      "ecs-orders-20260826T143015Z.csv",
    );
  });

  it("paginates and rejects exports above the synchronous ceiling", async () => {
    const offsets: number[] = [];
    const result = await exportOrdersToCsv({
      salesChannelId: "sc_1",
      listOrders: async ({ offset }) => {
        offsets.push(offset);
        return offset === 0
          ? {
              ok: true,
              orders: Array.from({ length: 100 }, (_, index) =>
                order({ id: `order_${index}`, customDisplayId: `AA-${index}` }),
              ),
              count: 101,
              limit: 100,
              offset,
            }
          : {
              ok: true,
              orders: [order({ id: "order_100", customDisplayId: "AA-100" })],
              count: 101,
              limit: 100,
              offset,
            };
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(offsets, [0, 100]);

    const tooLarge = await exportOrdersToCsv({
      salesChannelId: "sc_1",
      listOrders: async () => ({
        ok: true,
        orders: [],
        count: MAX_ORDER_EXPORT_COUNT + 1,
        limit: 100,
        offset: 0,
      }),
    });
    assert.deepEqual(tooLarge, { ok: false, error: "order_export_too_large", status: 413 });
  });
});
