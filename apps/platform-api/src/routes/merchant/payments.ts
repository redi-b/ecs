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

  // --- Bank catalog + receiving accounts (offline settlement labels) ---

  app.get("/platform/merchant/payments/banks", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantPaymentBanks) {
      return context.json({ error: "payments_unavailable" }, 503);
    }
    const result = await options.listMerchantPaymentBanks();
    return context.json(result);
  });

  app.get("/platform/merchant/payments/receiving-accounts", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.listMerchantReceivingAccounts) {
      return context.json({ error: "payments_unavailable" }, 503);
    }
    const includeInactive = context.req.query("includeInactive") === "1";
    const result = await options.listMerchantReceivingAccounts({
      tenantId: merchant.result.context.tenantId,
      includeInactive,
    });
    return context.json(result);
  });

  app.post("/platform/merchant/payments/receiving-accounts", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.createMerchantReceivingAccount) {
      return context.json({ error: "payments_unavailable" }, 503);
    }
    const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;
    const label = typeof body.label === "string" ? body.label : "";
    const bankName = typeof body.bankName === "string" ? body.bankName : "";
    if (!label.trim() || !bankName.trim()) {
      return context.json({ error: "invalid_receiving_account" }, 400);
    }
    const result = await options.createMerchantReceivingAccount({
      tenantId: merchant.result.context.tenantId,
      label,
      bankName,
      bankCode: typeof body.bankCode === "string" ? body.bankCode : null,
      accountName: typeof body.accountName === "string" ? body.accountName : null,
      accountNumber: typeof body.accountNumber === "string" ? body.accountNumber : null,
      isDefault: body.isDefault === true,
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result, 201);
  });

  app.post("/platform/merchant/payments/receiving-accounts/:accountId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.updateMerchantReceivingAccount) {
      return context.json({ error: "payments_unavailable" }, 503);
    }
    const body = (await context.req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await options.updateMerchantReceivingAccount({
      tenantId: merchant.result.context.tenantId,
      accountId: context.req.param("accountId"),
      ...(typeof body.label === "string" ? { label: body.label } : {}),
      ...(typeof body.bankName === "string" ? { bankName: body.bankName } : {}),
      ...(body.bankCode !== undefined
        ? { bankCode: typeof body.bankCode === "string" ? body.bankCode : null }
        : {}),
      ...(body.accountName !== undefined
        ? { accountName: typeof body.accountName === "string" ? body.accountName : null }
        : {}),
      ...(body.accountNumber !== undefined
        ? { accountNumber: typeof body.accountNumber === "string" ? body.accountNumber : null }
        : {}),
      ...(typeof body.isDefault === "boolean" ? { isDefault: body.isDefault } : {}),
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
  });

  app.delete("/platform/merchant/payments/receiving-accounts/:accountId", async (context) => {
    const merchant = await getAuthorizedMerchantContext(context);
    if (!merchant.ok) return merchant.response;
    if (!options.deleteMerchantReceivingAccount) {
      return context.json({ error: "payments_unavailable" }, 503);
    }
    const result = await options.deleteMerchantReceivingAccount({
      tenantId: merchant.result.context.tenantId,
      accountId: context.req.param("accountId"),
    });
    if (!result.ok) return context.json({ error: result.error }, result.status);
    return context.json(result);
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
