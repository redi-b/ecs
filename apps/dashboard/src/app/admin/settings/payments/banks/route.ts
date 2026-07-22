import { withMerchantAction } from "@/lib/platform-api/action-route";
import { createPlatformHeaders, normalizeBaseUrl } from "@/lib/platform-api/client";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(
      "/platform/merchant/payments/banks",
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
