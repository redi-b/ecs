import { withMerchantAction } from "@/lib/platform-api/action-route";
import { platformFetch } from "@/lib/platform-api/client";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const response = await platformFetch("/platform/merchant/promotions/batches", {
      body: await context.request.text(),
      contentType: "json",
      cookieHeader: context.cookieHeader,
      headers: { "idempotency-key": context.request.headers.get("idempotency-key") ?? "" },
      method: "POST",
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    const data = await response.json().catch(() => null);
    return response.ok
      ? { data, ok: true, status: 201 }
      : {
          message: (data as { error?: string } | null)?.error ?? "promotion_batch_create_failed",
          ok: false,
          status: response.status,
        };
  });
}
