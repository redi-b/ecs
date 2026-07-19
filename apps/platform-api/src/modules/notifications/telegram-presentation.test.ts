import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MerchantOrder, MerchantProductVariant } from "../../types/index.js";
import {
  adminUrl,
  formatOrderLineItemLabel,
  formatOrderListButtonLabel,
  formatVariantLabel,
  htmlLink,
  resolveDashboardAdminBase,
  shortPaymentLabel,
} from "./telegram-presentation.js";

function baseOrder(partial: Partial<MerchantOrder>): MerchantOrder {
  return {
    id: "order_01ABCDEFBY4JVY",
    displayId: 1,
    email: null,
    status: "pending",
    paymentStatus: "not_paid",
    fulfillmentStatus: "not_fulfilled",
    currencyCode: "etb",
    total: 7800,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("telegram-presentation", () => {
  it("shortPaymentLabel maps not_paid to Unpaid", () => {
    assert.equal(shortPaymentLabel("not_paid"), "Unpaid");
    assert.equal(shortPaymentLabel("captured"), "Paid");
  });

  it("order list label prefers customer over cryptic-only ref", () => {
    const label = formatOrderListButtonLabel(
      baseOrder({
        delivery: {
          choice: "delivery",
          customerName: "Abebe",
          customerPhone: "0911",
          landmark: null,
          notes: null,
        },
      }),
    );
    assert.ok(label.includes("Abebe"));
    assert.ok(label.includes("BY4JVY") || label.includes("7,800") || label.includes("7800"));
    assert.ok(label.includes("Unpaid"));
    assert.ok(label.length <= 56);
  });

  it("order list falls back to first item title", () => {
    const label = formatOrderListButtonLabel(
      baseOrder({
        items: [
          {
            id: "i1",
            title: "Denim Jacket",
            quantity: 1,
            unitPrice: 7800,
            total: 7800,
            thumbnail: null,
          },
        ],
      }),
    );
    assert.ok(label.includes("Denim Jacket"));
  });

  it("formatVariantLabel uses option values", () => {
    const variant: MerchantProductVariant = {
      id: "v1",
      title: "Default",
      sku: "SKU-1",
      prices: [],
      optionValues: [
        { optionTitle: "Size", value: "M" },
        { optionTitle: "Color", value: "Blue" },
      ],
    };
    assert.equal(formatVariantLabel(variant), "M / Blue");
  });

  it("formatVariantLabel falls back to sku when title is Default", () => {
    const variant: MerchantProductVariant = {
      id: "v1",
      title: "Default",
      sku: "LINEN-S",
      prices: [],
    };
    assert.equal(formatVariantLabel(variant), "LINEN-S");
  });

  it("resolveDashboardAdminBase prefers shop host", () => {
    assert.equal(
      resolveDashboardAdminBase({ primaryHostname: "shop.lvh.me", fallbackBaseUrl: "http://dashboard.lvh.me" }),
      "http://shop.lvh.me/admin",
    );
    assert.equal(
      resolveDashboardAdminBase({ primaryHostname: null, fallbackBaseUrl: "http://dashboard.lvh.me" }),
      "http://dashboard.lvh.me/admin",
    );
  });

  it("adminUrl and htmlLink", () => {
    assert.equal(adminUrl("http://x/admin", "/settings?tab=telegram"), "http://x/admin/settings?tab=telegram");
    assert.ok(htmlLink("https://example.com", "Go").includes("href="));
  });

  it("formatOrderLineItemLabel includes variant", () => {
    assert.equal(
      formatOrderLineItemLabel({
        productTitle: "Linen Midi Dress",
        variantTitle: "M / Sage",
        quantity: 2,
      }),
      "Linen Midi Dress · M / Sage × 2",
    );
  });
});
