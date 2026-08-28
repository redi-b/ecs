import { withMerchantAction } from "@/lib/platform-api/action-route";
import { getPlatformApiBaseUrl } from "@/lib/platform-api/client";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (!context.tenantId) {
      return { ok: false, message: "tenant_required", status: 400 };
    }

    const headers: Record<string, string> = {
      accept: "application/json",
      cookie: context.cookieHeader,
    };
    if (context.requestHost) headers["x-forwarded-host"] = context.requestHost;

    const url = new URL(
      `platform/tenants/${encodeURIComponent(context.tenantId)}/insights/refresh`,
      getPlatformApiBaseUrl(),
    );
    const response = await fetch(url, { headers, method: "POST" }).catch(() => null);
    if (!response) {
      return { ok: false, message: "insights_refresh_failed", status: 503 };
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error =
        data && typeof data === "object" && "error" in data && typeof data.error === "string"
          ? data.error
          : "insights_refresh_failed";
      return { ok: false, message: error, status: response.status };
    }

    return { ok: true, data, status: response.status };
  });
}
