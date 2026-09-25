import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildManualOrderPayload,
  calculateManualOrderPricing,
  canContinueFromManualOrderCustomer,
  canContinueFromManualOrderItems,
  emptyAddress,
  isManualOrderDraftDirty,
  MANUAL_ADDRESS_NEW,
  type ManualOrderDraft,
} from "./manual-order-model.js";

function draft(overrides: Partial<ManualOrderDraft> = {}): ManualOrderDraft {
  return {
    address: emptyAddress,
    adjustmentReason: "",
    customerEmail: "",
    customerFirstName: "",
    customerId: null,
    customerLastName: "",
    customerMode: "existing",
    customerPhone: "",
    discountType: "none",
    discountValue: "",
    includeAddress: true,
    lines: [],
    note: "",
    savedAddressId: MANUAL_ADDRESS_NEW,
    ...overrides,
  };
}

describe("manual order draft", () => {
  it("distinguishes untouched drafts from meaningful edits", () => {
    assert.equal(isManualOrderDraftDirty(draft()), false);
    assert.equal(isManualOrderDraftDirty(draft({ customerId: "cus_1" })), true);
    assert.equal(
      isManualOrderDraftDirty(
        draft({
          customerMode: "new",
          customerPhone: "0912345678",
        }),
      ),
      true,
    );
    assert.equal(
      isManualOrderDraftDirty(
        draft({
          address: { ...emptyAddress, city: "Addis Ababa" },
        }),
      ),
      true,
    );
  });

  it("validates customer and item progression without UI state", () => {
    assert.equal(
      canContinueFromManualOrderCustomer({
        customerId: "cus_1",
        customerMode: "existing",
        customerPhone: "",
      }),
      true,
    );
    assert.equal(
      canContinueFromManualOrderCustomer({
        customerId: null,
        customerMode: "new",
        customerPhone: "0912 345 678",
      }),
      true,
    );
    assert.equal(canContinueFromManualOrderItems([]), false);
    assert.equal(
      canContinueFromManualOrderItems([{ quantity: 2, unitPrice: null, variantId: "var_1" }]),
      true,
    );
  });

  it("rejects discounts above the order subtotal and accepts a justified adjustment", () => {
    const variants = new Map([
      [
        "var_1",
        {
          id: "var_1",
          availableQuantity: 10,
          currencyCode: "etb",
          label: "Coffee",
          optionSwatches: {},
          options: {},
          priceAmount: 100,
          priceLabel: "ETB 100",
          productId: "prod_1",
          productTitle: "Coffee",
          sku: null,
          thumbnailUrl: null,
          variantTitle: "Default",
        },
      ],
    ]);
    const lines = [{ quantity: 2, unitPrice: null, variantId: "var_1" }];

    assert.equal(
      calculateManualOrderPricing(lines, variants, "fixed", "250", "Promo").adjustmentIsValid,
      false,
    );
    const pricing = calculateManualOrderPricing(lines, variants, "percentage", "10", "Promo");
    assert.equal(pricing.merchandiseSubtotal, 200);
    assert.equal(pricing.discountAmount, 20);
    assert.equal(pricing.adjustmentIsValid, true);
  });

  it("normalizes the API payload in one place", () => {
    const current = draft({
      address: {
        address1: " Bole ",
        city: " Addis Ababa ",
        firstName: "",
        lastName: "",
        phone: "",
        province: "",
      },
      adjustmentReason: " Launch offer ",
      customerEmail: " SHOP@EXAMPLE.COM ",
      customerFirstName: " Hana ",
      customerLastName: " Tesfaye ",
      customerMode: "new",
      customerPhone: " 0912345678 ",
      discountType: "fixed",
      discountValue: "20",
      lines: [{ quantity: 1, unitPrice: 120, variantId: "var_1" }],
      note: " Call first ",
    });

    assert.deepEqual(
      buildManualOrderPayload(current, {
        hasPriceAdjustment: true,
        parsedDiscountValue: 20,
      }),
      {
        customerEmail: "shop@example.com",
        customerFirstName: "Hana",
        customerId: null,
        customerLastName: "Tesfaye",
        customerPhone: "0912345678",
        items: [{ quantity: 1, unitPrice: 120, variantId: "var_1" }],
        discount: { type: "fixed", value: 20 },
        adjustmentReason: "Launch offer",
        note: "Call first",
        shippingAddress: {
          address1: "Bole",
          city: "Addis Ababa",
          countryCode: "et",
          firstName: "Hana",
          lastName: "Tesfaye",
          phone: "0912345678",
          province: null,
        },
      },
    );
  });
});
