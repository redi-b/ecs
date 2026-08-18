import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getCustomerOrder, getStoreCustomer, updateStoreCustomer } from "./account.js";

describe("storefront customer normalization", () => {
  it("returns only the stable profile fields used by templates and checkout", async () => {
    let authorization = "";
    const result = await getStoreCustomer({
      fetcher: async (request) => {
        authorization = request instanceof Request
          ? request.headers.get("authorization") ?? ""
          : "";
        return Response.json({
          customer: {
            id: "cus_1",
            email: "customer@example.com",
            first_name: "Liya",
            last_name: "Tadesse",
            phone: "+251911000000",
            metadata: { internal_note: "must not leak into the view model" },
          },
        });
      },
      platformApiBaseUrl: "http://platform.test",
      requestHost: "shop.test",
      token: "customer_token",
    });

    assert.equal(authorization, "Bearer customer_token");
    assert.deepEqual(result, {
      id: "cus_1",
      email: "customer@example.com",
      firstName: "Liya",
      lastName: "Tadesse",
      phone: "+251911000000",
    });
  });

  it("updates profiles through the narrow platform account endpoint", async () => {
    let forwardedUrl = "";
    let forwardedMethod = "";
    const result = await updateStoreCustomer({
      fetcher: async (request) => {
        const forwarded = request instanceof Request ? request : new Request(request);
        forwardedUrl = forwarded.url;
        forwardedMethod = forwarded.method;
        return Response.json({
          customer: {
            id: "cus_1",
            email: "customer@example.com",
            first_name: "Liya",
            last_name: "Tadesse",
            phone: "+251911000000",
          },
        });
      },
      firstName: "Liya",
      lastName: "Tadesse",
      phone: "+251911000000",
      platformApiBaseUrl: "http://platform.test",
      requestHost: "shop.test",
      token: "customer_token",
    });

    assert.equal(new URL(forwardedUrl).pathname, "/store/customer/profile");
    assert.equal(forwardedMethod, "POST");
    assert.deepEqual(result, {
      id: "cus_1",
      email: "customer@example.com",
      firstName: "Liya",
      lastName: "Tadesse",
      phone: "+251911000000",
    });
  });

  it("normalizes a private order into the template-safe order detail model", async () => {
    const result = await getCustomerOrder({
      fetcher: async () => Response.json({
        order: {
          id: "order_1",
          display_id: 38,
          created_at: "2026-08-18T10:00:00.000Z",
          status: "pending",
          currency_code: "etb",
          total: 4485,
          subtotal: 5050,
          shipping_total: 75,
          discount_total: 640,
          items: [{
            id: "item_1",
            product_title: "Linen Midi Dress",
            variant_title: "S / Ivory",
            thumbnail: "https://images.test/dress.jpg",
            quantity: 2,
            unit_price: 2560,
            total: 5120,
          }],
          shipping_methods: [{ name: "Local delivery" }],
          shipping_address: {
            first_name: "Liya",
            last_name: "Tadesse",
            address_1: "Bole Road",
            city: "Addis Ababa",
            country_code: "et",
          },
          fulfillments: [{
            shipped_at: "2026-08-19T10:00:00.000Z",
            labels: [{ tracking_number: "TRACK-1", tracking_url: "https://carrier.test/TRACK-1" }],
          }],
        },
      }),
      orderId: "order_1",
      platformApiBaseUrl: "http://platform.test",
      requestHost: "shop.test",
      token: "customer_token",
    });

    assert.deepEqual(result, {
      id: "order_1",
      displayId: 38,
      customDisplayId: null,
      createdAt: "2026-08-18T10:00:00.000Z",
      status: "pending",
      currencyCode: "etb",
      total: 4485,
      itemCount: 2,
      items: [{
        id: "item_1",
        title: "Linen Midi Dress",
        variantTitle: "S / Ivory",
        thumbnail: "https://images.test/dress.jpg",
        quantity: 2,
        unitPrice: 2560,
        total: 5120,
      }],
      subtotal: 5050,
      shippingTotal: 75,
      taxTotal: null,
      discountTotal: 640,
      shippingAddress: {
        firstName: "Liya",
        lastName: "Tadesse",
        phone: "",
        address1: "Bole Road",
        address2: "",
        city: "Addis Ababa",
        province: "",
        postalCode: "",
        countryCode: "et",
      },
      shippingMethod: "Local delivery",
      fulfillmentState: "shipped",
      trackingNumber: "TRACK-1",
      trackingUrl: "https://carrier.test/TRACK-1",
    });
  });
});
