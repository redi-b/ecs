import type { Hono } from "hono";

import { createChapaPaymentService } from "../../adapters/chapa/payment-service.js";
import type { PlatformAppOptions, PlatformAppVariables } from "../../app.js";
import { getJsonBody, getRequiredBodyString } from "../shared.js";
import type { MerchantRouteHelpers } from "./context.js";

/**
 * Merchant store payments (buyer → merchant Chapa).
 * Never uses platform billing CHAPA_SECRET_KEY for store secrets.
 */
export function registerMerchantPaymentRoutes(
  app: Hono<{ Variables: PlatformAppVariables }>,
  options: PlatformAppOptions,
  helpers: MerchantRouteHelpers,
) {
  const { getAuthorizedMerchantContext } = helpers;

  app.get("/platform/merchant/payments", async (context) => {
    if (!options.getMerchantStorePaymentStatus) {
      return context.json({ error: "payments_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) {
      return merchant.response;
    }

    const result = await options.getMerchantStorePaymentStatus({
      tenantId: merchant.result.context.tenantId,
    });

    return context.json(result);
  });

  app.post("/platform/merchant/payments/chapa/credentials", async (context) => {
    if (!options.setMerchantChapaSecret) {
      return context.json({ error: "payments_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) {
      return merchant.response;
    }

    const body = await getJsonBody(context.req.raw);
    const secretKey = getRequiredBodyString(body, "secretKey");
    if (!secretKey) {
      return context.json({ error: "missing_secret_key" }, 400);
    }

    const validation = await validateChapaSecretKey(secretKey, options);
    if (!validation.ok) {
      return context.json(
        { error: "chapa_credentials_invalid", message: validation.message },
        400,
      );
    }

    const onlineEnabled = body?.onlineEnabled === true;
    const result = await options.setMerchantChapaSecret({
      tenantId: merchant.result.context.tenantId,
      secretKey,
      onlineEnabled,
      userId: merchant.session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, 400);
    }

    const status = options.getMerchantStorePaymentStatus
      ? await options.getMerchantStorePaymentStatus({
          tenantId: merchant.result.context.tenantId,
        })
      : null;

    return context.json({
      ok: true,
      fingerprint: result.fingerprint,
      payment: status && "payment" in status ? status.payment : undefined,
    });
  });

  app.post("/platform/merchant/payments/chapa/test", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) {
      return merchant.response;
    }

    const body = await getJsonBody(context.req.raw);
    let secretKey = getRequiredBodyString(body, "secretKey");

    if (!secretKey && options.getMerchantChapaCredentials) {
      const stored = await options.getMerchantChapaCredentials({
        tenantId: merchant.result.context.tenantId,
        requireOnlineEnabled: false,
      });
      if (stored.ok) {
        secretKey = stored.secretKey;
      }
    }

    if (!secretKey) {
      return context.json({ error: "missing_secret_key" }, 400);
    }

    const validation = await validateChapaSecretKey(secretKey, options);
    if (!validation.ok) {
      return context.json(
        { error: "chapa_credentials_invalid", message: validation.message, ok: false },
        400,
      );
    }

    return context.json({ ok: true, message: "chapa_credentials_valid" });
  });

  app.patch("/platform/merchant/payments/chapa", async (context) => {
    if (!options.setMerchantChapaOnlineEnabled) {
      return context.json({ error: "payments_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) {
      return merchant.response;
    }

    const body = await getJsonBody(context.req.raw);
    if (typeof body?.onlineEnabled !== "boolean") {
      return context.json({ error: "missing_online_enabled" }, 400);
    }

    const result = await options.setMerchantChapaOnlineEnabled({
      tenantId: merchant.result.context.tenantId,
      onlineEnabled: body.onlineEnabled,
      userId: merchant.session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, 409);
    }

    const status = options.getMerchantStorePaymentStatus
      ? await options.getMerchantStorePaymentStatus({
          tenantId: merchant.result.context.tenantId,
        })
      : null;

    return context.json({
      ok: true,
      payment: status && "payment" in status ? status.payment : undefined,
    });
  });

  app.delete("/platform/merchant/payments/chapa/credentials", async (context) => {
    if (!options.clearMerchantChapaSecret) {
      return context.json({ error: "payments_unavailable" }, 503);
    }

    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) {
      return merchant.response;
    }

    const result = await options.clearMerchantChapaSecret({
      tenantId: merchant.result.context.tenantId,
      userId: merchant.session.user.id,
    });

    if (!result.ok) {
      return context.json({ error: result.error }, 409);
    }

    return context.json({ ok: true });
  });
}

async function validateChapaSecretKey(
  secretKey: string,
  options: PlatformAppOptions,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const chapa = createChapaPaymentService({ secretKey });
  const platformPublic =
    options.platformPublicBaseUrl?.replace(/\/$/, "") ?? "http://localhost:3000";
  const fallbackEmail =
    process.env.CHAPA_FALLBACK_EMAIL?.trim() || "payments-validate@example.com";

  try {
    await chapa.initializePayment({
      amount: "1.00",
      currency: "ETB",
      email: fallbackEmail,
      firstName: "Key",
      lastName: "Check",
      txRef: `ecs_validate_${Date.now().toString(36)}`,
      callbackUrl: `${platformPublic}/platform/payments/chapa/callback`,
      returnUrl: `${platformPublic}/`,
      title: "Key check",
      description: "Validate merchant key",
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "chapa_credentials_invalid";
    return { ok: false, message };
  }
}
