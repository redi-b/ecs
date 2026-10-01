import assert from "node:assert/strict";
import { test } from "node:test";

import { createMedusaShippingPriceClient } from "./update-shipping-price.js";

test("rejects a Medusa response that does not confirm the requested price", async () => {
  const update = createMedusaShippingPriceClient({
    fetch: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          amount: 50,
          currencyCode: "etb",
        }),
        { status: 200 },
      ),
    internalApiToken: "secret",
    medusaInternalUrl: "http://medusa:9000",
  });

  const result = await update({
    amount: 75,
    currencyCode: "ETB",
    shippingOptionId: "so_delivery",
  });

  assert.deepEqual(result, { ok: false, error: "commerce_backend_error" });
});

test("accepts a verified Medusa price update", async () => {
  const update = createMedusaShippingPriceClient({
    fetch: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          amount: 75,
          currencyCode: "etb",
        }),
        { status: 200 },
      ),
    internalApiToken: "secret",
    medusaInternalUrl: "http://medusa:9000",
  });

  const result = await update({
    amount: 75,
    currencyCode: "ETB",
    shippingOptionId: "so_delivery",
  });

  assert.deepEqual(result, { ok: true });
});
