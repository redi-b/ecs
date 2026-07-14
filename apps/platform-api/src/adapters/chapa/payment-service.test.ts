import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createChapaPaymentService } from "./payment-service.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createChapaPaymentService", () => {
  it("verifies successful Chapa callbacks and records payment.paid", async () => {
    const notifications: {
      eventType: string;
      payload?: unknown;
      tenantId: string;
    }[] = [];
    const analyticsEvents: {
      eventType: string;
      idempotencyKey?: string | null | undefined;
      properties?: unknown;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }[] = [];

    globalThis.fetch = async (input, init) => {
      assert.equal(String(input), "https://api.chapa.co/v1/transaction/verify/tx_1");
      assert.equal((init?.headers as Record<string, string>).authorization, "Bearer sk_test");

      return Response.json({
        status: "success",
        data: {
          ref_id: "chapa_ref_1",
          status: "success",
          tx_ref: "tx_1",
        },
      });
    };

    const service = createChapaPaymentService({
      recordNotificationEvent: async (input) => {
        notifications.push(input);

        return {
          ok: true,
          logCount: 1,
          logIds: ["log_1"],
        };
      },
      recordAnalyticsEvent: async (input) => {
        analyticsEvents.push(input);

        return {
          ok: true,
          duplicate: false,
          event: {
            id: "event_1",
            eventType: input.eventType,
            occurredAt: "2026-01-01T12:00:00.000Z",
            receivedAt: "2026-01-01T12:00:01.000Z",
            source: input.source,
          },
        };
      },
      secretKey: "sk_test",
    });

    const result = await service.handleChapaPaymentCallback({
      reportedStatus: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });

    assert.deepEqual(result, {
      ok: true,
      eventType: "payment.paid",
      providerReference: "chapa_ref_1",
      status: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });
    assert.deepEqual(notifications, [
      {
        eventType: "payment.paid",
        payload: {
          providerReference: "chapa_ref_1",
          reportedStatus: "success",
          status: "success",
          txRef: "tx_1",
        },
        tenantId: "tenant_1",
      },
    ]);
    assert.deepEqual(analyticsEvents, [
      {
        eventType: "payment.captured",
        idempotencyKey: "chapa:tx_1:payment.captured",
        properties: {
          provider: "chapa",
          providerReference: "chapa_ref_1",
          reportedStatus: "success",
          status: "success",
          txRef: "tx_1",
        },
        source: "platform",
        subjectId: "tx_1",
        subjectType: "payment",
        tenantId: "tenant_1",
      },
    ]);
  });

  it("records payment.webhook_failed when verification cannot be completed", async () => {
    const notifications: {
      eventType: string;
      payload?: unknown;
      tenantId: string;
    }[] = [];
    const analyticsEvents: {
      eventType: string;
      idempotencyKey?: string | null | undefined;
      properties?: unknown;
      source: "medusa" | "platform" | "storefront";
      subjectId?: string | null | undefined;
      subjectType?: string | null | undefined;
      tenantId: string;
    }[] = [];

    globalThis.fetch = async () => {
      throw new Error("network unavailable");
    };

    const service = createChapaPaymentService({
      recordNotificationEvent: async (input) => {
        notifications.push(input);

        return {
          ok: true,
          logCount: 1,
          logIds: ["log_1"],
        };
      },
      recordAnalyticsEvent: async (input) => {
        analyticsEvents.push(input);

        return {
          ok: true,
          duplicate: false,
          event: {
            id: "event_1",
            eventType: input.eventType,
            occurredAt: "2026-01-01T12:00:00.000Z",
            receivedAt: "2026-01-01T12:00:01.000Z",
            source: input.source,
          },
        };
      },
      secretKey: "sk_test",
    });

    const result = await service.handleChapaPaymentCallback({
      reportedStatus: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });

    assert.deepEqual(result, {
      ok: false,
      error: "chapa_verification_failed",
      status: 502,
    });
    assert.deepEqual(notifications, [
      {
        eventType: "payment.webhook_failed",
        payload: {
          reason: "verification_request_failed",
          reportedStatus: "success",
          txRef: "tx_1",
        },
        tenantId: "tenant_1",
      },
    ]);
    assert.deepEqual(analyticsEvents, [
      {
        eventType: "payment.webhook_failed",
        idempotencyKey: "chapa:tx_1:payment.webhook_failed",
        properties: {
          provider: "chapa",
          reason: "verification_request_failed",
          reportedStatus: "success",
          txRef: "tx_1",
        },
        source: "platform",
        subjectId: "tx_1",
        subjectType: "payment",
        tenantId: "tenant_1",
      },
    ]);
  });

  it("does not fail verified callbacks when analytics recording fails", async () => {
    const notifications: {
      eventType: string;
      payload?: unknown;
      tenantId: string;
    }[] = [];

    globalThis.fetch = async () =>
      Response.json({
        status: "success",
        data: {
          ref_id: "chapa_ref_1",
          status: "success",
          tx_ref: "tx_1",
        },
      });

    const service = createChapaPaymentService({
      recordAnalyticsEvent: async () => {
        throw new Error("analytics unavailable");
      },
      recordNotificationEvent: async (input) => {
        notifications.push(input);

        return {
          ok: true,
          logCount: 1,
          logIds: ["log_1"],
        };
      },
      secretKey: "sk_test",
    });

    const result = await service.handleChapaPaymentCallback({
      reportedStatus: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });

    assert.deepEqual(result, {
      ok: true,
      eventType: "payment.paid",
      providerReference: "chapa_ref_1",
      status: "success",
      tenantId: "tenant_1",
      txRef: "tx_1",
    });
    assert.equal(notifications.length, 1);
  });
});
