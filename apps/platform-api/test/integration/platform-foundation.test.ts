import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { appWithResolution, resolvedTenantContext } from "../support/platform-app-harness.js";

describe("platform app foundation", () => {
  it("returns health status", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/health");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      ok: true,
      service: "platform-api",
    });
  });

  it("reports configured social sign-in providers", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      { googleAuthEnabled: true },
    );

    const response = await app.request("/platform/auth/providers");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { google: true });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });

  it("adds request ids to platform responses and platform-owned errors", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/platform/me", {
      headers: {
        "x-request-id": "req_test_1",
      },
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("x-request-id"), "req_test_1");
    assert.deepEqual(await response.json(), {
      error: "auth_required",
      requestId: "req_test_1",
    });
  });

  it("allows the configured landing origin to check session state with credentials", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      { landingPublicOrigins: ["http://ecs.lvh.me:4321"] },
    );

    const response = await app.request("/platform/me", {
      headers: { origin: "http://ecs.lvh.me:4321" },
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("access-control-allow-credentials"), "true");
    assert.equal(response.headers.get("access-control-allow-origin"), "http://ecs.lvh.me:4321");
    assert.equal(response.headers.get("vary"), "Origin");
  });

  it("handles Chapa payment callbacks with verified payment state", async () => {
    let callbackInput:
      | {
          providerReference?: string | null | undefined;
          reportedStatus?: string | null | undefined;
          tenantId?: string | null | undefined;
          txRef?: string | null | undefined;
        }
      | undefined;
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        handleChapaPaymentCallback: async (input) => {
          callbackInput = input;

          return {
            ok: true,
            eventType: "payment.paid",
            providerReference: "chapa_ref_1",
            status: "success",
            tenantId: "tenant_1",
            txRef: "tx_1",
          };
        },
      },
    );

    const response = await app.request(
      "/platform/payments/chapa/callback?trx_ref=tx_1&ref_id=chapa_ref_1&status=success&tenant_id=tenant_1",
    );

    assert.equal(response.status, 200);
    assert.deepEqual(callbackInput, {
      providerReference: "chapa_ref_1",
      reportedStatus: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });
    assert.deepEqual(await response.json(), {
      payment: {
        eventType: "payment.paid",
        providerReference: "chapa_ref_1",
        status: "success",
        tenantId: "tenant_1",
        txRef: "tx_1",
      },
    });
  });

  it("rejects Chapa callbacks without tenant context", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        handleChapaPaymentCallback: async () => ({
          ok: false,
          error: "missing_tenant_context",
          status: 400,
        }),
      },
    );

    const response = await app.request("/platform/payments/chapa/callback?trx_ref=tx_1");

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "missing_tenant_context",
    });
  });

  it("returns shop_context_required for central store requests without trusted shop context", async () => {
    const app = appWithResolution({ ok: false, error: "shop_context_required" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "api.lvh.me",
      },
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "shop_context_required",
    });
  });

  it("returns shop_not_found for unknown storefront hosts", async () => {
    const app = appWithResolution({ ok: false, error: "shop_not_found" });

    const response = await app.request("/store/products", {
      headers: {
        Host: "missing.lvh.me",
      },
    });

    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: "shop_not_found",
    });
  });

  it("records storefront analytics events for the resolved host tenant", async () => {
    let recordedEvent:
      | {
          customerId?: string | null | undefined;
          eventType: string;
          idempotencyKey?: string | null | undefined;
          occurredAt?: string | null | undefined;
          properties?: unknown;
          sessionId?: string | null | undefined;
          source: "medusa" | "platform" | "storefront";
          subjectId?: string | null | undefined;
          subjectType?: string | null | undefined;
          tenantId: string;
        }
      | undefined;
    const app = appWithResolution(
      {
        ok: true,
        context: resolvedTenantContext,
      },
      {
        recordAnalyticsEvent: async (input) => {
          recordedEvent = input;

          return {
            ok: true,
            duplicate: false,
            event: {
              id: "event_1",
              eventType: "storefront.page_viewed",
              occurredAt: "2026-01-01T12:00:00.000Z",
              receivedAt: "2026-01-01T12:00:01.000Z",
              source: "storefront",
            },
          };
        },
      },
    );

    const response = await app.request("/store/analytics/events", {
      body: JSON.stringify({
        eventType: "storefront.page_viewed",
        idempotencyKey: "view-1",
        occurredAt: "2026-01-01T12:00:00.000Z",
        properties: {
          path: "/products/coffee",
          tenantId: "tenant_from_body_should_be_ignored",
        },
        sessionId: "anonymous-session-1",
        tenantId: "tenant_from_body_should_be_ignored",
      }),
      headers: {
        "content-type": "application/json",
        Host: "abebe.lvh.me",
      },
      method: "POST",
    });

    assert.equal(response.status, 202);
    assert.deepEqual(recordedEvent, {
      customerId: null,
      eventType: "storefront.page_viewed",
      idempotencyKey: "view-1",
      occurredAt: "2026-01-01T12:00:00.000Z",
      properties: {
        path: "/products/coffee",
        tenantId: "tenant_from_body_should_be_ignored",
      },
      sessionId: "anonymous-session-1",
      source: "storefront",
      subjectId: null,
      subjectType: null,
      tenantId: "tenant_1",
    });
    assert.deepEqual(await response.json(), {
      event: {
        duplicate: false,
        id: "event_1",
      },
    });
  });

  it("mounts platform auth routes", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        authHandler: async (request) =>
          Response.json({
            method: request.method,
            path: new URL(request.url).pathname,
          }),
      },
    );

    const response = await app.request("/platform/auth/get-session");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      method: "GET",
      path: "/platform/auth/get-session",
    });
  });

  it("returns the current platform session user", async () => {
    const app = appWithResolution(
      { ok: false, error: "shop_context_required" },
      {
        getSession: async () => ({
          user: {
            id: "user_1",
            email: "owner@abebe.local",
            name: "Abebe Owner",
          },
        }),
      },
    );

    const response = await app.request("/platform/me");

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: {
        id: "user_1",
        email: "owner@abebe.local",
        name: "Abebe Owner",
      },
    });
  });
});
