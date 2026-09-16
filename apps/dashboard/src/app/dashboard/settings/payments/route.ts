import {
  clearMerchantChapaCredentials,
  getMerchantPaymentsStatus,
  setMerchantChapaCredentials,
  setMerchantChapaOnlineEnabled,
  testMerchantChapaCredentials,
} from "@/lib/platform-api/payments/client";
import { withMerchantAction } from "@/lib/platform-api";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const result = await getMerchantPaymentsStatus({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { payment: result.payment }, status: 200 };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await request.json().catch(() => ({}))) as {
      action?: string;
      onlineEnabled?: boolean;
      secretKey?: string;
    };

    const common = {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    };

    const action = body.action ?? "save";

    if (action === "test") {
      const result = await testMerchantChapaCredentials({
        ...common,
        ...(typeof body.secretKey === "string" ? { secretKey: body.secretKey } : {}),
      });
      if (!result.ok) {
        return { ok: false, message: result.message, status: result.status };
      }
      return { ok: true, data: { ok: true }, status: 200 };
    }

    if (action === "toggle") {
      if (typeof body.onlineEnabled !== "boolean") {
        return { ok: false, message: "missing_online_enabled", status: 400 };
      }
      const result = await setMerchantChapaOnlineEnabled({
        ...common,
        onlineEnabled: body.onlineEnabled,
      });
      if (!result.ok) {
        return { ok: false, message: result.message, status: result.status };
      }
      return { ok: true, data: { payment: result.payment }, status: 200 };
    }

    if (action === "clear") {
      const result = await clearMerchantChapaCredentials(common);
      if (!result.ok) {
        return { ok: false, message: result.message, status: result.status };
      }
      return { ok: true, data: { ok: true }, status: 200 };
    }

    const secretKey = typeof body.secretKey === "string" ? body.secretKey.trim() : "";
    if (!secretKey) {
      return { ok: false, message: "missing_secret_key", status: 400 };
    }

    const result = await setMerchantChapaCredentials({
      ...common,
      secretKey,
      onlineEnabled: body.onlineEnabled === true,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return {
      ok: true,
      data: { payment: result.payment, fingerprint: result.fingerprint },
      status: 200,
    };
  });
}
