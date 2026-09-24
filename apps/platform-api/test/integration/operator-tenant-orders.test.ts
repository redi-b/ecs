import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, type MerchantOrderAction } from "../support/platform-app-harness.js";

describe("operator tenant order operations", () => {
  it("lists tenant orders scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let ordersInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        listMerchantOrders: async (input) => {
          ordersInput = input;

          return {
            ok: true,
            count: 1,
            limit: input.limit,
            offset: input.offset,
            orders: [
              {
                id: "order_1",
                displayId: 1001,
                email: "customer@example.com",
                status: "pending",
                paymentStatus: "awaiting",
                fulfillmentStatus: "not_fulfilled",
                currencyCode: "etb",
                total: 1250,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-02T00:00:00.000Z",
              },
            ],
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders?limit=5&offset=10");

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(ordersInput, {
      limit: 5,
      offset: 10,
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      orders: [
        {
          id: "order_1",
          displayId: 1001,
          email: "customer@example.com",
          status: "pending",
          paymentStatus: "awaiting",
          fulfillmentStatus: "not_fulfilled",
          currencyCode: "etb",
          total: 1250,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
      count: 1,
      limit: 5,
      offset: 10,
    });
  });

  it("returns tenant order details scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        getMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "awaiting",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [
                {
                  id: "item_1",
                  title: "Coffee",
                  quantity: 2,
                  unitPrice: 500,
                  total: 1000,
                  thumbnail: null,
                },
              ],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders/order_1");

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "awaiting",
        fulfillmentStatus: "not_fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [
          {
            id: "item_1",
            title: "Coffee",
            quantity: 2,
            unitPrice: 500,
            total: 1000,
            thumbnail: null,
          },
        ],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("cancels tenant orders scoped to the selected tenant sales channel", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          action: MerchantOrderAction;
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner", role: "owner" },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "canceled",
              paymentStatus: "canceled",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders/order_1/cancel", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      action: "cancel",
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "canceled",
        paymentStatus: "canceled",
        fulfillmentStatus: "not_fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("fulfills tenant orders scoped to the selected tenant stock location", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          action: MerchantOrderAction;
          orderId: string;
          salesChannelId: string;
          stockLocationId?: string | undefined;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner", role: "owner" },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaStockLocationId: "sloc_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "fulfilled",
              currencyCode: "etb",
              total: 1250,
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/tenants/tenant_1/orders/order_1/fulfill", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      action: "fulfill",
      orderId: "order_1",
      salesChannelId: "channel_1",
      shippingOptionId: undefined,
      stockLocationId: "sloc_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "captured",
        fulfillmentStatus: "fulfilled",
        currencyCode: "etb",
        total: 1250,
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("marks tenant order fulfillments as delivered for the selected tenant", async () => {
    let commerceInput:
      | {
          tenantId: string;
          userId: string;
        }
      | undefined;
    let orderInput:
      | {
          action: MerchantOrderAction;
          fulfillmentId?: string | undefined;
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: false,
        error: "shop_context_required",
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe Owner", role: "owner" },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        getTenantCommerceContext: async (input) => {
          commerceInput = input;

          return {
            ok: true,
            context: {
              tenantId: "tenant_1",
              medusaStoreId: "store_1",
              medusaSalesChannelId: "channel_1",
              medusaPublishableKeyId: "pk_1",
              medusaRegionId: "reg_1",
            },
          };
        },
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "delivered",
              currencyCode: "etb",
              total: 1250,
              fulfillments: [
                {
                  id: "ful_1",
                  deliveredAt: "2026-01-03T00:00:00.000Z",
                  shippedAt: null,
                  canceledAt: null,
                },
              ],
              items: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-03T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request(
      "/platform/tenants/tenant_1/orders/order_1/fulfillments/ful_1/deliver",
      {
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
    assert.deepEqual(commerceInput, {
      tenantId: "tenant_1",
      userId: "user_1",
    });
    assert.deepEqual(orderInput, {
      action: "deliver",
      fulfillmentId: "ful_1",
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "pending",
        paymentStatus: "captured",
        fulfillmentStatus: "delivered",
        currencyCode: "etb",
        total: 1250,
        fulfillments: [
          {
            id: "ful_1",
            deliveredAt: "2026-01-03T00:00:00.000Z",
            shippedAt: null,
            canceledAt: null,
          },
        ],
        items: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z",
      },
    });
  });
});
