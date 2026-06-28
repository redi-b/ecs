import assert from "node:assert/strict";
import test from "node:test";

import { getStoreDeliveryOptions, listStoreProducts } from "./platform-store.js";

test("listStoreProducts calls the platform store facade with host context", async () => {
  const requests: Request[] = [];
  const productsResponse = {
    count: 1,
    limit: 8,
    offset: 0,
    products: [
      {
        description: null,
        id: "prod_123",
        title: "Coffee",
        handle: "coffee",
        thumbnail: null,
      },
    ],
  };

  const result = await listStoreProducts({
    fetcher: async (request) => {
      requests.push(request);
      return Response.json(productsResponse);
    },
    platformApiBaseUrl: "http://api.lvh.me",
    requestHost: "abebe.lvh.me",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://api.lvh.me/store/products?limit=8");
  assert.equal(requests[0]?.headers.get("x-forwarded-host"), "abebe.lvh.me");
  assert.deepEqual(result, productsResponse);
});

test("listStoreProducts returns an error result when platform response fails", async () => {
  const result = await listStoreProducts({
    fetcher: async () =>
      Response.json({ error: "shop_not_found" }, { status: 404, statusText: "Not Found" }),
    platformApiBaseUrl: "http://api.lvh.me/",
    requestHost: "missing.lvh.me",
  });

  assert.equal("ok" in result && result.ok, false);
  assert.equal("status" in result, true);
  assert.equal("message" in result, true);
  if (!("status" in result) || !("message" in result)) {
    throw new Error("Expected an error result.");
  }
  assert.equal(result.status, 404);
  assert.equal(result.message, "shop_not_found");
});

test("getStoreDeliveryOptions calls the platform store facade with host context", async () => {
  const requests: Request[] = [];
  const deliveryResponse = {
    delivery: {
      deliveryEnabled: true,
      pickupEnabled: true,
      phoneConfirmationRequired: true,
      notesEnabled: true,
      landmarkRequired: false,
      defaultDeliveryFee: "50.00",
      currency: "ETB",
      zones: [
        {
          name: "Bole",
          fee: "75.00",
        },
      ],
    },
  };

  const result = await getStoreDeliveryOptions({
    fetcher: async (request) => {
      requests.push(request);
      return Response.json(deliveryResponse);
    },
    platformApiBaseUrl: "http://api.lvh.me",
    requestHost: "abebe.lvh.me",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://api.lvh.me/store/delivery");
  assert.equal(requests[0]?.headers.get("x-forwarded-host"), "abebe.lvh.me");
  assert.deepEqual(result, deliveryResponse);
});
