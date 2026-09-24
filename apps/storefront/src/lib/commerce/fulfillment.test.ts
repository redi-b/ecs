import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveStoreFulfillmentOptions } from "./fulfillment.js";

const delivery = {
  deliveryEnabled: true,
  pickupEnabled: true,
  phoneConfirmationRequired: true,
  notesEnabled: true,
  landmarkRequired: false,
  defaultDeliveryFee: "75",
  currency: "ETB",
  zones: [],
};

describe("resolveStoreFulfillmentOptions", () => {
  it("keeps pickup separate and detects a stale delivery price", () => {
    const result = resolveStoreFulfillmentOptions(
      [
        { id: "delivery", name: "Local delivery", amount: 50, currencyCode: "etb" },
        { id: "pickup", name: "Store Pickup", amount: 0, currencyCode: "etb" },
      ],
      delivery,
    );

    assert.deepEqual(result.deliveryOptions.map((option) => option.id), ["delivery"]);
    assert.equal(result.pickupOption?.id, "pickup");
    assert.equal(result.priceMismatch, true);
  });

  it("accepts the configured delivery amount", () => {
    const result = resolveStoreFulfillmentOptions(
      [{ id: "delivery", name: "Local delivery", amount: 75, currencyCode: "etb" }],
      delivery,
    );

    assert.equal(result.priceMismatch, false);
  });
});
