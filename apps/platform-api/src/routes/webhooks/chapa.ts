import type { Hono } from "hono";

import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody } from "../shared.js";
import { getRequestValue } from "../platform/helpers.js";

export function registerChapaWebhookRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
) {
  app.on(["GET", "POST"], "/platform/payments/chapa/callback", async (context) => {
    if (!options.handleChapaPaymentCallback) {
      return context.json({ error: "payments_unavailable" }, 503);
    }

    const url = new URL(context.req.raw.url);
    const body = context.req.raw.method === "POST" ? await getJsonBody(context.req.raw) : undefined;
    const result = await options.handleChapaPaymentCallback({
      providerReference: getRequestValue(body, url, "ref_id", "reference"),
      reportedStatus: getRequestValue(body, url, "status"),
      tenantId: getRequestValue(body, url, "tenant_id", "tenantId"),
      txRef: getRequestValue(body, url, "trx_ref", "tx_ref", "txRef"),
    });

    if (!result.ok) {
      return context.json({ error: result.error }, result.status);
    }

    return context.json({
      payment: {
        eventType: result.eventType,
        providerReference: result.providerReference,
        status: result.status,
        tenantId: result.tenantId,
        txRef: result.txRef,
      },
    });
  });
}
