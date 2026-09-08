import { withMerchantAction } from "@/lib/platform-api/action-route";
import { normalizeBaseUrl } from "@/lib/platform-api/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ optionSetId: string }> },
) {
  return withMerchantAction(request, async (context) => {
    const { optionSetId } = await params;
    const path = context.tenantId
      ? `/platform/tenants/${encodeURIComponent(context.tenantId)}/product-option-sets/${encodeURIComponent(optionSetId)}`
      : `/platform/merchant/product-option-sets/${encodeURIComponent(optionSetId)}`;
    const response = await fetch(new URL(path, normalizeBaseUrl(context.platformApiBaseUrl)), {
      body: await request.text(),
      cache: "no-store",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: context.cookieHeader,
        ...(context.requestHost ? { "x-forwarded-host": context.requestHost } : {}),
      },
      method: "POST",
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
    return { ok: true, data };
  });
}
