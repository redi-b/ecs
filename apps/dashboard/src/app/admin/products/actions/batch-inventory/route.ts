import { updateMerchantInventoryBatch } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    if (context.tenantId) {
      return { ok: false, message: "selected_tenant_inventory_batch_unavailable", status: 400 };
    }
    const body = (await context.request.json().catch(() => ({}))) as { updates?: unknown };
    if (!Array.isArray(body.updates)) {
      return { ok: false, message: "invalid_inventory_updates", status: 400 };
    }
    const result = await updateMerchantInventoryBatch({
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      updates: body.updates as Array<{
        productId: string;
        variantId: string;
        stockedQuantity: number;
      }>,
    });
    if (!result.ok) return result;
    return { ok: true, data: result };
  });
}
