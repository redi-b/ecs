import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { createChapaPaymentService } from "./chapa-payment-service.js";

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
  });

  it("records payment.webhook_failed when verification cannot be completed", async () => {
    const notifications: {
      eventType: string;
      payload?: unknown;
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
  });
});
