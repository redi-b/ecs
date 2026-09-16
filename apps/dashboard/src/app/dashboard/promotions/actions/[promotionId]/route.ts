import { withMerchantAction } from "@/lib/platform-api/action-route";
import { platformFetch } from "@/lib/platform-api/client";

function path(id: string) {
  return `/platform/merchant/promotions/${encodeURIComponent(id)}`;
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ promotionId: string }> },
) {
  const { promotionId } = await params;
  return withMerchantAction(request, async (context) => {
    const response = await platformFetch(path(promotionId), {
      body: await context.request.text(),
      contentType: "json",
      cookieHeader: context.cookieHeader,
      method: "POST",
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    const data = await response.json().catch(() => null);
    return response.ok
      ? { data, ok: true }
      : {
          message: (data as { error?: string } | null)?.error ?? "promotion_update_failed",
          ok: false,
          status: response.status,
        };
  });
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ promotionId: string }> },
) {
  const { promotionId } = await params;
  return withMerchantAction(request, async (context) => {
    const response = await platformFetch(path(promotionId), {
      cookieHeader: context.cookieHeader,
      method: "DELETE",
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
    });
    const data = await response.json().catch(() => null);
    return response.ok
      ? { data, ok: true }
      : {
          message: (data as { error?: string } | null)?.error ?? "promotion_delete_failed",
          ok: false,
          status: response.status,
        };
  });
}
