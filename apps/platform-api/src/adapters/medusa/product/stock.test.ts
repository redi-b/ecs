import assert from "node:assert/strict";
import test from "node:test";

import { findRequestedVariant, hydrateProductsWithStock } from "./stock.js";

test("matches a requested stock row by persisted variant ID", () => {
  const requested = findRequestedVariant({ id: "variant_1", options: [] }, [
    {
      id: "variant_1",
      optionValues: { Size: "M" },
      priceAmount: 1200,
      currencyCode: "etb",
      stockedQuantity: 7,
    },
  ]);

  assert.equal(requested?.stockedQuantity, 7);
});

test("matches a newly created variant by its exact option values", () => {
  const requested = findRequestedVariant(
    {
      id: "variant_generated",
      options: [
        { value: "M", option: { title: "Size" } },
        { value: "Black", option: { title: "Color" } },
      ],
    },
    [
      {
        optionValues: { Color: "Black", Size: "M" },
        priceAmount: 1200,
        currencyCode: "etb",
        stockedQuantity: 9,
      },
    ],
  );

  assert.equal(requested?.stockedQuantity, 9);
});

test("does not match a partial option combination", () => {
  const requested = findRequestedVariant(
    {
      options: [
        { value: "M", option: { title: "Size" } },
        { value: "Black", option: { title: "Color" } },
      ],
    },
    [
      {
        optionValues: { Size: "M" },
        priceAmount: 1200,
        currencyCode: "etb",
        stockedQuantity: 9,
      },
    ],
  );

  assert.equal(requested, undefined);
});

test("hydrates unique inventory items in one list request", async () => {
  const requests: URL[] = [];
  const products = ["1", "2"].map((id) => ({
    id: `prod_${id}`,
    title: `Product ${id}`,
    variants: [
      {
        id: `variant_${id}`,
        inventoryItemId: `iitem_${id}`,
        prices: [],
      },
    ],
  })) as unknown as Parameters<typeof hydrateProductsWithStock>[2]["products"];
  const result = await hydrateProductsWithStock(
    async (input) => {
      const url = input instanceof URL ? input : new URL(String(input));
      requests.push(url);
      return Response.json({
        inventory_items: ["1", "2"].map((id) => ({
          id: `iitem_${id}`,
          location_levels: [
            {
              location_id: "sloc_1",
              stocked_quantity: 3,
              reserved_quantity: 0,
              incoming_quantity: 0,
              available_quantity: 3,
            },
          ],
        })),
        count: 2,
      });
    },
    { adminApiToken: "token", medusaInternalUrl: "http://medusa.test" },
    { products, stockLocationId: "sloc_1" },
  );

  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.searchParams.getAll("id[]"), ["iitem_1", "iitem_2"]);
  assert.equal(result[1]?.variants?.[0]?.stock?.availableQuantity, 3);
});
