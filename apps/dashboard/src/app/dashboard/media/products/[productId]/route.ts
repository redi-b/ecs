import { withMerchantAction } from "@/lib/platform-api/action-route";
import { platformFetch } from "@/lib/platform-api/client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;
  return withMerchantAction(request, async (context) => {
    const body = await context.request.text();
    const response = await platformFetch(
      `/platform/merchant/media/products/${encodeURIComponent(productId)}`,
      {
        cookieHeader: context.cookieHeader,
        platformApiBaseUrl: context.platformApiBaseUrl,
        requestHost: context.requestHost,
        body,
        contentType: "json",
        method: "POST",
      },
    );
    const data = await response.json().catch(() => null);
    return response.ok
      ? { data, ok: true }
      : { message: "media_sync_failed", ok: false, status: response.status };
  });
}
