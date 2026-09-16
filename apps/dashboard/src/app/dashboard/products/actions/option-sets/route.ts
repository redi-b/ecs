import { withMerchantAction } from "@/lib/platform-api/action-route";
import { normalizeBaseUrl } from "@/lib/platform-api/client";

async function forward(request: Request, method: "GET" | "POST") {
  return withMerchantAction(request, async (context) => {
    const body = method === "POST" ? await request.text() : null;
    const path = context.tenantId
      ? `/platform/tenants/${encodeURIComponent(context.tenantId)}/product-option-sets`
      : "/platform/merchant/product-option-sets";
    const response = await fetch(new URL(path, normalizeBaseUrl(context.platformApiBaseUrl)), {
      ...(body !== null ? { body } : {}),
      cache: "no-store",
      headers: {
        accept: "application/json",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        cookie: context.cookieHeader,
        ...(context.requestHost ? { "x-forwarded-host": context.requestHost } : {}),
      },
      method,
    }).catch(() => null);

    if (!response) return { ok: false, message: "platform_request_failed", status: 503 };
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      return {
        ok: false,
        message: typeof data.error === "string" ? data.error : "option_set_request_failed",
        status: response.status,
      };
    }
    return { ok: true, data, status: response.status };
  });
}

export function GET(request: Request) {
  return forward(request, "GET");
}

export function POST(request: Request) {
  return forward(request, "POST");
}
