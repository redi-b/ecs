import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  appWithResolution,
  type MerchantOrderAction,
  resolvedTenantContext,
} from "../support/platform-app-harness.js";

describe("merchant order operations", () => {
  it("lists merchant orders scoped to the resolved tenant sales channel", async () => {
    let ordersInput:
      | {
          limit: number;
          offset: number;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
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

    const response = await app.request("/platform/merchant/orders?limit=5&offset=10", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
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

  it("exports a tenant-scoped operational order CSV and records the audit event", async () => {
    let auditInput:
      | {
          actorUserId: string;
          exportType: "orders" | "customers";
          rowCount: number;
          schemaVersion: string;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        listMerchantOrders: async (input) => ({
          ok: true,
          count: 1,
          limit: input.limit,
          offset: input.offset,
          orders: [
            {
              id: "order_internal_1",
              displayId: 1001,
              customDisplayId: "SHOP-1001",
              email: "private@example.com",
              paymentReference: "private-reference",
              status: "pending",
              paymentStatus: "captured",
              fulfillmentStatus: "not_fulfilled",
              currencyCode: "etb",
              total: 1250,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          ],
        }),
        recordMerchantDataExport: async (input) => {
          auditInput = input;
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/export.csv", {
      headers: { Host: "abebe.lvh.me" },
    });
    const csv = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/csv/);
    assert.equal(response.headers.get("x-ecs-export-schema"), "ecs-orders-v1");
    assert.match(csv, /SHOP-1001/);
    assert.equal(csv.includes("private@example.com"), false);
    assert.equal(csv.includes("private-reference"), false);
    assert.deepEqual(auditInput, {
      actorUserId: "user_1",
      exportType: "orders",
      rowCount: 1,
      schemaVersion: "ecs-orders-v1",
      tenantId: "tenant_1",
    });
  });

  it("fails closed when order export audit recording is unavailable", async () => {
    const app = appWithResolution(
      { ok: true, context: resolvedTenantContext },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: { id: "user_1", email: "owner@abebe.local", name: "Abebe", role: "owner" },
        }),
        getSession: async () => ({
          user: { id: "user_1", email: "owner@abebe.local", name: "Abebe" },
        }),
        listMerchantOrders: async (input) => ({
          ok: true,
          count: 0,
          limit: input.limit,
          offset: input.offset,
          orders: [],
        }),
        recordMerchantDataExport: async () => {
          throw new Error("audit unavailable");
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/export.csv", {
      headers: { Host: "abebe.lvh.me" },
    });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: "export_audit_unavailable" });
  });

  it("requires a platform session for merchant order access", async () => {
    const app = appWithResolution({
      ok: true,
      context: resolvedTenantContext,
    });

    const response = await app.request("/platform/merchant/orders", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "auth_required",
    });
  });

  it("returns merchant order details scoped to the resolved tenant sales channel", async () => {
    let orderInput:
      | {
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
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
              delivery: {
                choice: "delivery",
                customerName: "Abebe Kebede",
                customerPhone: "+251911111111",
                landmark: "Blue gate",
                notes: "Call before arrival",
              },
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
              shippingAddress: {
                firstName: "Abebe",
                lastName: "Kebede",
                phone: "+251911111111",
                address1: "Bole Road",
                address2: null,
                city: "Addis Ababa",
                province: null,
                postalCode: null,
                countryCode: "et",
              },
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1", {
      headers: {
        Host: "abebe.lvh.me",
      },
    });

    assert.equal(response.status, 200);
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
        delivery: {
          choice: "delivery",
          customerName: "Abebe Kebede",
          customerPhone: "+251911111111",
          landmark: "Blue gate",
          notes: "Call before arrival",
        },
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
        shippingAddress: {
          firstName: "Abebe",
          lastName: "Kebede",
          phone: "+251911111111",
          address1: "Bole Road",
          address2: null,
          city: "Addis Ababa",
          province: null,
          postalCode: null,
          countryCode: "et",
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    });
  });

  it("completes merchant orders scoped to the resolved tenant sales channel", async () => {
    let orderInput:
      | {
          action: MerchantOrderAction;
          orderId: string;
          salesChannelId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        mutateMerchantOrder: async (input) => {
          orderInput = input;

          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "completed",
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

    const response = await app.request("/platform/merchant/orders/order_1/complete", {
      headers: {
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(orderInput, {
      action: "complete",
      orderId: "order_1",
      salesChannelId: "channel_1",
    });
    assert.deepEqual(await response.json(), {
      order: {
        id: "order_1",
        displayId: 1001,
        email: "customer@example.com",
        status: "completed",
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

  it("keeps payment separate when finishing fulfillment", async () => {
    let receivedAction: MerchantOrderAction | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
        mutateMerchantOrder: async (input) => {
          receivedAction = input.action;
          return {
            ok: true,
            order: {
              id: "order_1",
              displayId: 1001,
              email: "customer@example.com",
              status: "completed",
              paymentStatus: "not_paid",
              fulfillmentStatus: "delivered",
              currencyCode: "etb",
              total: 1250,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
            },
          };
        },
      },
    );

    const response = await app.request("/platform/merchant/orders/order_1/finish", {
      body: JSON.stringify({ markPaid: true }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(receivedAction, "finish");
  });

  it("fulfills merchant orders from the resolved tenant stock location", async () => {
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
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
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

    const response = await app.request("/platform/merchant/orders/order_1/fulfill", {
      headers: {
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(orderInput, {
      action: "fulfill",
      orderId: "order_1",
      salesChannelId: "channel_1",
      shippingOptionId: "so_1",
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

  it("marks merchant order fulfillments as delivered for the resolved tenant", async () => {
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
        ok: true,
        context: resolvedTenantContext,
      },
      {
        authorizeDashboardForTenant: async () => ({
          ok: true,
          actor: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
            role: "owner",
          },
        }),
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
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
      "/platform/merchant/orders/order_1/fulfillments/ful_1/deliver",
      {
        headers: {
          Host: "abebe.lvh.me",
        },
        method: "POST",
      },
    );

    assert.equal(response.status, 200);
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
