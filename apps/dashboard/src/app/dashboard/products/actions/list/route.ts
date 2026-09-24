import { getMerchantProducts } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);

    const result = await getMerchantProducts({
      cookieHeader: context.cookieHeader,
      limit: Number.isFinite(limit) ? Math.min(limit, 100) : 50,
      offset: Number.isFinite(offset) ? offset : 0,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    // `getMerchantProducts` returns the full list payload as `products`
    // ({ products, count, limit, offset }) for pagination-aware pickers.
    return { ok: true, data: result.products };
  });
}
