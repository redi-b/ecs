import { getMerchantProducts } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";
import { suggestAvailableProductHandle } from "@/features/products/product-form-state";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const handle = url.searchParams.get("handle")?.trim().toLowerCase() ?? "";
    const excludeId = url.searchParams.get("excludeId")?.trim() ?? "";

    if (!handle) return { ok: true, data: { available: false } };

    const result = await getMerchantProducts({
      cookieHeader: context.cookieHeader,
      limit: 100,
      offset: 0,
      platformApiBaseUrl: context.platformApiBaseUrl,
      q: handle,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    const usedHandles = new Set(
      result.products.products.flatMap((product) =>
        product.id !== excludeId && product.handle ? [product.handle.toLowerCase()] : [],
      ),
    );
    if (!usedHandles.has(handle)) return { ok: true, data: { available: true } };

    return {
      ok: true,
      data: { available: false, suggestedHandle: suggestAvailableProductHandle(handle, usedHandles) },
    };
  });
}
