import assert from "node:assert/strict";
import test from "node:test";

import { createStoreCart, getStoreDeliveryOptions, listStoreProducts } from "./index.js";
import { normalizeProduct } from "./normalize.js";

test("listStoreProducts calls the platform store facade with host context", async () => {
  const requests: Request[] = [];
  const productsResponse = {
    count: 1,
    limit: 24,
    offset: 0,
    products: [
      {
        description: null,
        id: "prod_123",
        title: "Coffee",
        handle: "coffee",
        thumbnail: null,
        variants: [],
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
    regionId: "reg_1",
  });

  assert.equal(requests.length, 1);
  assert.ok(requests[0]?.url.startsWith("http://api.lvh.me/store/products?"));
  assert.ok(requests[0]?.url.includes("limit=24"));
  assert.ok(requests[0]?.url.includes("region_id=reg_1"));
  assert.equal(requests[0]?.headers.get("x-forwarded-host"), "abebe.lvh.me");
  assert.equal("products" in result && result.products[0]?.handle, "coffee");
});

test("listStoreProducts returns an error result when platform response fails", async () => {
  const result = await listStoreProducts({
    fetcher: async () =>
      Response.json({ error: "shop_not_found" }, { status: 404, statusText: "Not Found" }),
    platformApiBaseUrl: "http://api.lvh.me/",
    requestHost: "missing.lvh.me",
  });

  assert.equal("ok" in result && result.ok, false);
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
      zones: [{ name: "Bole", fee: "75.00" }],
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

test("createStoreCart creates a Medusa cart through the platform facade", async () => {
  const requests: Request[] = [];
  const result = await createStoreCart({
    fetcher: async (request) => {
      requests.push(request);

      return Response.json(
        {
          cart: {
            id: "cart_1",
            region_id: "reg_1",
            currency_code: "etb",
            email: null,
            item_total: 0,
            total: 0,
            items: [],
          },
        },
        { status: 201 },
      );
    },
    platformApiBaseUrl: "http://api.lvh.me",
    regionId: "reg_1",
    requestHost: "abebe.lvh.me",
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://api.lvh.me/store/carts");
  assert.equal(requests[0]?.method, "POST");
  assert.equal(requests[0]?.headers.get("content-type"), "application/json");
  assert.equal(requests[0]?.headers.get("x-forwarded-host"), "abebe.lvh.me");
  assert.deepEqual(JSON.parse(String(await requests[0]?.text())), {
    region_id: "reg_1",
  });
  assert.equal("cart" in result && result.cart.id, "cart_1");
  assert.equal("cart" in result && result.cart.regionId, "reg_1");
});

test("normalizeProduct maps calculated prices and variants", () => {
  const product = normalizeProduct({
    id: "prod_1",
    title: "Shirt",
    handle: "shirt",
    thumbnail: "https://example.com/a.jpg",
    options: [{ id: "opt_1", title: "Size" }],
    variants: [
      {
        id: "var_1",
        title: "M",
        manage_inventory: true,
        allow_backorder: false,
        inventory_quantity: 3,
        options: [{ option_id: "opt_1", value: "M" }],
        calculated_price: {
          calculated_amount: 499,
          currency_code: "etb",
        },
      },
    ],
  });

  assert.equal(product.handle, "shirt");
  assert.equal(product.priceAmount, 499);
  assert.equal(product.variants[0]?.inStock, true);
  assert.equal(product.variants[0]?.optionValues[0]?.value, "M");
});
