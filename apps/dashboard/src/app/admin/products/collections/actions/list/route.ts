import { getMerchantProductCollections } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function GET(request: Request) {
  return withMerchantAction(request, async (context) => {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? 100);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const q = url.searchParams.get("q")?.trim() || undefined;

    const result = await getMerchantProductCollections({
      cookieHeader: context.cookieHeader,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 100,
      offset: Number.isFinite(offset) ? Math.max(offset, 0) : 0,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
      ...(q ? { q } : {}),
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return {
      ok: true,
      data: {
        collections: result.collections,
        count: result.count,
        limit: result.limit,
        offset: result.offset,
      },
    };
  });
}
