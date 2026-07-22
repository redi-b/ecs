import { withMerchantAction } from "@/lib/platform-api/action-route";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(
      "/platform/merchant/payments/receiving-accounts",
      normalizeBaseUrl(context.platformApiBaseUrl),
    );
    const response = await fetch(url, {
      cache: "no-store",
      headers: createPlatformHeaders({
        cookieHeader: context.cookieHeader,
        requestHost: context.requestHost,
      }),
    }).catch(() => null);

    if (!response) {
      return { ok: false, message: "payments_unavailable", status: 503 };
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        message: typeof data?.error === "string" ? data.error : "payments_unavailable",
        status: response.status,
      };
    }
    return { ok: true, data };
  });
}

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = await context.request.json().catch(() => ({}));
    const url = new URL(
      "/platform/merchant/payments/receiving-accounts",
      normalizeBaseUrl(context.platformApiBaseUrl),
    );
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      cache: "no-store",
      headers: createPlatformHeaders({
        cookieHeader: context.cookieHeader,
        contentType: "application/json",
        requestHost: context.requestHost,
      }),
    }).catch(() => null);

    if (!response) {
      return { ok: false, message: "payments_unavailable", status: 503 };
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        message: typeof data?.error === "string" ? data.error : "payments_unavailable",
        status: response.status,
      };
    }
    return { ok: true, data, status: 201 };
  });
}
