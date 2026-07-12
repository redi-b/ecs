import { withMerchantAction } from "@/lib/platform-api/action-route";
import { platformFetch } from "@/lib/platform-api/client";
export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = await context.request.text();
    const response = await platformFetch("/platform/merchant/customers", {
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      body,
      contentType: "json",
      method: "POST",
    });
    const data = await response.json().catch(() => null);
    return response.ok
      ? { data, ok: true, status: 201 }
      : {
          message: (data as any)?.error ?? "customer_create_failed",
          ok: false,
          status: response.status,
        };
  });
}
