import { deleteMerchantProductCategoriesBatch } from "@/lib/merchant-products";
import { withMerchantAction } from "@/lib/platform-api/action-route";

export async function POST(request: Request) {
  return withMerchantAction(request, async (context) => {
    const body = (await context.request.json().catch(() => ({}))) as {
      categoryIds?: unknown;
    };

    if (!body.categoryIds || !Array.isArray(body.categoryIds) || body.categoryIds.length === 0) {
      return { ok: false, message: "invalid_category_ids", status: 400 };
    }

    const categoryIds = body.categoryIds.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );

    if (categoryIds.length === 0) {
      return { ok: false, message: "invalid_category_ids", status: 400 };
    }

    const result = await deleteMerchantProductCategoriesBatch({
      categoryIds,
      cookieHeader: context.cookieHeader,
      platformApiBaseUrl: context.platformApiBaseUrl,
      requestHost: context.requestHost,
      tenantId: context.tenantId,
    });

    if (!result.ok) {
      return { ok: false, message: result.message, status: result.status };
    }

    return { ok: true, data: { success: true, ids: result.ids } };
  });
}
