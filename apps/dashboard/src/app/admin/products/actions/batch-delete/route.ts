import { deleteMerchantProductsBatch } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as {
      productIds?: unknown;
    };

    if (!body.productIds || !Array.isArray(body.productIds) || body.productIds.length === 0) {
      return { ok: false, message: "invalid_product_ids", status: 400 };
    }

    const productIds = body.productIds.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );

    if (productIds.length === 0) {
      return { ok: false, message: "invalid_product_ids", status: 400 };
    }

    const result = await deleteMerchantProductsBatch({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      productIds,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { success: true, ids: result.ids } };
  });
}
